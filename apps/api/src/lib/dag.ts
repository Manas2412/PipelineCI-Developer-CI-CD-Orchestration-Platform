import * as yaml from "js-yaml"
import type { PipelineDef, StepDef, DagNode, DagGraph } from "types"

// ─────────────────────────────────────────────────────────────
// Parse raw YAML string into a typed PipelineDef
// ─────────────────────────────────────────────────────────────

export function parsePipelineYaml(raw: string) {
    let parsed: unknown

    try {
        parsed = yaml.load(raw)
    } catch (err) {
        throw new Error(`Invalid YAML: ${(err as Error).message}`)
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Pipeline YAML must be an object at the top level')
    }

    const obj = parsed as Record<string, unknown>

    if (!obj.name || typeof obj.name !== 'string') {
        throw new Error('Pipeline YAML must have a "name" field')
    }

    if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
        throw new Error('Pipeline YAML must have a non-empty "steps" array')
    }

    const steps: StepDef[] = obj.steps.map((s: unknown, i: number) => {
        if (!s || typeof s !== 'object') {
            throw new Error(`Step ${i} must be an object`)
        }

        const step = s as Record<string, unknown>

        if (!step.name || typeof step.name !== 'string') {
            throw new Error(`Step ${i} must have a "name" field`)
        }

        if (!step.image || typeof step.image !== 'string') {
            throw new Error(`Step "${step.name}" must have an "image" field`)
        }

        if (!Array.isArray(step.commands) || step.commands.length === 0) {
            throw new Error(`Step "${step.name}" must have a non-empty "commands" array`)
        }

        return {
            name: step.name as string,
            image: step.image as string,
            commands: step.commands as string[],
            dependsOn: Array.isArray(step.dependsOn) ? (step.dependsOn as string[]) : [],
            env: step.env && typeof step.env === 'object' ? (step.env as Record<string, string>) : {},
            timeout: typeof step.timeout === 'number' ? step.timeout : 600,
            continueOnError: step.continueOnError === true,
        }
    })

    return {
        name: obj.name,
        steps,
        env: obj.env && typeof obj.env === 'object' ? (obj.env as Record<string, string>) : {}
    }
}


// ─────────────────────────────────────────────────────────────
// Build a DagGraph from a PipelineDef
// ─────────────────────────────────────────────────────────────

export function buildDag(def: PipelineDef): DagGraph {
    const names = new Set(def.steps.map((s) => s.name))

    // Validate all dependsOn references exist
    for (const step of def.steps) {
        for (const dep of step.dependsOn ?? []) {
            if (!names.has(dep)) {
                throw new Error(`Step "${step.name}" depends on unknown step "${dep}"`)
            }

            if (dep === step.name) {
                throw new Error(`Step "${step.name}" cannot depend on itself`)
            }
        }
    }

    // Build adjacency : for each step record who it depends on and who depends on it
    const graph: DagGraph = {}

    for (const step of def.steps) {
        graph[step.name] = {
            name: step.name,
            dependsOn: step.dependsOn ?? [],
            dependents: [],
            depth: 0
        }
    }

    for (const step of def.steps) {
        for (const dep of step.dependsOn ?? []) {
            graph[dep]!.dependents.push(step.name)
        }
    }

    //Detect cycles with DFS
    detectCycle(graph)

    //Compute depth(longest path from a root)
    computeDepths(graph)

    return graph
}


// ─────────────────────────────────────────────────────────────
// Topological sort — returns step names in execution order
// (Kahn's algorithm using in-degree)
// ─────────────────────────────────────────────────────────────
export function topoSort(graph: DagGraph): string[][] {
    //Return layers: [[root steps], [next layer], ...]
    //Steps in the same layer can run in parallel

    const inDegree: Record<string, number> = {}

    for (const name of Object.keys(graph)) {
        inDegree[name] = graph[name]!.dependsOn.length
    }

    const layers: string[][] = []
    let currentLayer = Object.keys(inDegree).filter((n) => inDegree[n]! === 0)

    while (currentLayer.length > 0) {
        layers.push(currentLayer)
        const nextLayer: string[] = []

        for (const name of currentLayer) {
            const node = graph[name]
            if (!node) continue

            for (const dependent of node.dependents) {
                inDegree[dependent]!--
                if (inDegree[dependent]! === 0) {
                    nextLayer.push(dependent)
                }
            }
        }

        currentLayer = nextLayer
    }

    const processed = layers.flat().length
    if (processed !== Object.keys(graph).length) {
        throw new Error('Cycle detected in Pipeline DAG during topo sort')
    }

    return layers
}


// ─────────────────────────────────────────────────────────────
// Get the names of steps that are ready to run given a set
// of already-completed step names
// ─────────────────────────────────────────────────────────────
export function getReadySteps(
    graph: DagGraph,
    completeNames: Set<string>,
    failedNames: Set<string>,
    runningNames: Set<string>
): string[] {
    return Object.values(graph)
        .filter((node) => {
            //Already done or running - skip
            if (completeNames.has(node.name))
                return false
            if (failedNames.has(node.name))
                return false
            if (runningNames.has(node.name))
                return false

            //All dependencies must be completed (not failed)
            const allDepsComplete = node.dependsOn.every((dep) => completeNames.has(dep))
            const anyDepFailed = node.dependsOn.some((dep) => failedNames.has(dep))

            return allDepsComplete && !anyDepFailed
        })
        .map((n) => n.name)
}


// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function detectCycle(graph: DagGraph): void {
    const WHITE = 0 // unvisited
    const GRAY = 1 // currently in DFS stack
    const BLACK = 2 // fully processed

    const color: Record<string, number> = {}
    for (const name of Object.keys(graph)) color[name] = WHITE

    function dfs(name: string, path: string[]): void {
        color[name] = GRAY

        const node = graph[name]
        if (!node) return

        for (const dep of node.dependsOn) {
            if (color[dep] === GRAY)
                throw new Error(`Cycle detected in pipeline DAG: ${[...path, name, dep].join(' -> ')}`)

            if (color[dep] === WHITE)
                dfs(dep, [...path, name])
        }

        color[name] = BLACK
    }

    for (const name of Object.keys(graph)) {
        if (color[name] === WHITE)
            dfs(name, [])
    }
}

function computeDepths(graph: DagGraph): void {
    const visited = new Set<string>()

    function depth(name: string): number {
        if (visited.has(name))
            return graph[name]!.depth

        visited.add(name)
        const node = graph[name]
        if (!node) return 0 // Should not happen

        const deps = node.dependsOn

        if (deps.length === 0)
            node.depth = 0
        else
            node.depth = Math.max(...deps.map((d: string) => depth(d))) + 1

        return node.depth
    }
    for (const name of Object.keys(graph)) {
        depth(name)
    }
}