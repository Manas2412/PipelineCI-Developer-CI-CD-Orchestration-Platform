import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { 
  Rocket, 
  Cpu, 
  GitBranch, 
  ShieldCheck, 
  Activity, 
  Layout, 
  Zap, 
  Terminal,
  ArrowRight,
  Check
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-zinc-800/50 bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Rocket size={18} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">PipelineCI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-zinc-100 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-zinc-100 transition-colors">How it Works</a>
            <a href="#enterprise" className="hover:text-zinc-100 transition-colors">Enterprise</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <span className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer">Log in</span>
            </Link>
            <Link href="/register">
              <span className="bg-zinc-100 text-zinc-950 px-4 py-2 rounded-full text-sm font-bold hover:bg-zinc-200 transition-all cursor-pointer">Get Started</span>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent opacity-50 blur-3xl -z-10" />
          
          <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 text-xs font-semibold mb-8">
              <Zap size={12} fill="currentColor" />
              <span>Version 1.0 is now live</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
              Orchestrate your code <br /> with lightning speed.
            </h1>
            
            <p className="max-w-2xl mx-auto text-lg text-zinc-400 mb-10 leading-relaxed">
              PipelineCI is the developer-first CI/CD platform built for speed, transparency, and monorepo scale. Visualize your DAG, stream real-time logs, and deploy with confidence.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/register">
                <span className="w-full sm:w-auto px-8 py-4 bg-indigo-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer">
                  Start Building Free <ArrowRight size={18} />
                </span>
              </Link>
              <div className="flex items-center gap-2 text-sm text-zinc-500 group cursor-pointer border border-zinc-800 px-8 py-4 rounded-xl hover:bg-zinc-900 transition-all">
                <Terminal size={18} />
                <span>bun install pipeline-ci</span>
              </div>
            </div>

            {/* Hero Graphic */}
            <div className="relative max-w-5xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-900/50 p-2 shadow-2xl overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 via-transparent to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <Image 
                src="/hero.png" 
                alt="PipelineCI Visual Dashboard" 
                width={1280}
                height={720}
                className="rounded-xl border border-zinc-800 relative z-10 w-full"
                priority
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-zinc-950/50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Built for the Modern Developer</h2>
              <p className="text-zinc-500">Every tool you need to ship high-quality software, automated.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Layout,
                  title: "Visual DAG Explorer",
                  desc: "Understand complex build dependencies at a glance with our interactive Directed Acyclic Graph preview."
                },
                {
                  icon: Cpu,
                  title: "High-Speed Runners",
                  desc: "Native support for Bun and Node.js with optimized container scheduling for millisecond execution."
                },
                {
                  icon: GitBranch,
                  title: "Monorepo Scalability",
                  desc: "Intelligent caching and parallelized layer execution ensure fast builds even for the largest codebases."
                },
                {
                  icon: Activity,
                  title: "Real-time Streaming",
                  desc: "No more refreshing. Watch logs stream directly from your runners via high-performance SSE."
                },
                {
                  icon: ShieldCheck,
                  title: "Enterprise Security",
                  desc: "RBAC, audit logs, and encrypted secret management keep your pipeline and production environments safe."
                },
                {
                  icon: Zap,
                  title: "Developer First API",
                  desc: "Trigger runs, query status, and manage pipelines programmatically with our robust REST & GraphQL APIs."
                }
              ].map((f, i) => (
                <div key={i} className="p-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-all hover:scale-[1.02] cursor-default">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 text-indigo-400">
                    <f.icon size={24} />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* YAML Section */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-indigo-500 font-bold text-sm tracking-widest uppercase mb-4">Declarative Config</div>
              <h2 className="text-4xl font-bold mb-6 italic prose-white leading-tight">Define once. <br /> Run anywhere.</h2>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Simple, intuitive YAML configuration that developers actually love. Define your steps, dependencies, and environments in a single file and let PipelineCI handle the orchestration.
              </p>
              <ul className="space-y-4">
                {[
                  "Native support for Node 20 & Bun 1.x",
                  "Parallel execution by default",
                  "Environment variable inheritance",
                  "Custom Docker image support"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <Check size={12} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl font-mono text-sm leading-relaxed relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <div className="w-3 h-3 rounded-full bg-zinc-800" />
              </div>
              <pre className="text-zinc-300">
                <code className="block">
<span className="text-purple-400">name</span>: <span className="text-zinc-100">My Pipeline</span><br />
<br />
<span className="text-purple-400">steps</span>:<br />
  - <span className="text-purple-400">name</span>: <span className="text-zinc-100">install</span><br />
    <span className="text-purple-400">image</span>: <span className="text-zinc-100">oven/bun:1-alpine</span><br />
    <span className="text-purple-400">commands</span>:<br />
      - <span className="text-zinc-500">bun install</span><br />
<br />
  - <span className="text-purple-400">name</span>: <span className="text-zinc-100">test</span><br />
    <span className="text-purple-400">image</span>: <span className="text-zinc-100">oven/bun:1-alpine</span><br />
    <span className="text-purple-400">dependsOn</span>: [<span className="text-zinc-100">install</span>]<br />
    <span className="text-purple-400">commands</span>:<br />
      - <span className="text-zinc-500">bun test</span><br />
<br />
  - <span className="text-purple-400">name</span>: <span className="text-zinc-100">build</span><br />
    <span className="text-purple-400">image</span>: <span className="text-zinc-100">node:20-alpine</span><br />
    <span className="text-purple-400">dependsOn</span>: [<span className="text-zinc-100">test</span>]<br />
    <span className="text-purple-400">commands</span>:<br />
      - <span className="text-zinc-500">npm run build</span>
                </code>
              </pre>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-600/10 blur-[120px] -z-10" />
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-4xl font-bold mb-6">Ready to ship faster?</h2>
            <p className="text-zinc-400 mb-10 text-lg">Join thousands of developers automating their workflow with PipelineCI.</p>
            <Link href="/register">
              <span className="inline-flex items-center gap-2 px-10 py-5 bg-zinc-100 text-zinc-950 rounded-2xl font-bold text-lg hover:bg-white transition-all transform hover:-translate-y-1 cursor-pointer">
                Get Started for Free <ArrowRight size={20} />
              </span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800/50 py-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2 opacity-50">
            <Rocket size={18} />
            <span className="font-bold text-lg">PipelineCI</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-zinc-500">
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Twitter</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">GitHub</a>
          </div>
          <p className="text-sm text-zinc-600">© 2026 PipelineCI Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
