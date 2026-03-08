"use client";

import React from "react";
import Link from "next/link";
import { Header } from "@/components/header-with-search";
import Footer from "@/components/footer-1";
import {
  IconShieldCheck,
  IconBolt,
  IconReceipt,
  IconClock,
  IconArrowRight,
  IconCheck,
  IconWallet,
  IconChartPie
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export default function AppHome() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32 md:pt-36 md:pb-40">
          {/* Animated Background Gradients */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] bg-primary/20 blur-[100px] sm:blur-[120px] rounded-full pointer-events-none opacity-70 animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-blue-500/10 blur-[80px] rounded-full pointer-events-none opacity-50" />

          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary mb-8 border border-primary/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] backdrop-blur-sm transition-all hover:bg-primary/15 cursor-default">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-xs sm:text-sm font-medium tracking-wide">BillSync Auto-Pay Engine 2.0 is live</span>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8 max-w-5xl leading-[1.1]">
              <span className="bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent">Automate your bills.</span>
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-primary via-blue-500 to-cyan-400 bg-clip-text text-transparent opacity-90"> Reclaim your time.</span>
            </h1>

            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl leading-relaxed font-light">
              BillSync is the ultimate smart payment engine. Connect your essentials once, and let our secure infrastructure handle the rest without late fees.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mt-4 px-4 sm:px-0">
              <Link href="/auth/signup" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] flex items-center justify-center gap-2">
                  Get Started Free
                  <IconArrowRight size={20} className="mt-0.5" />
                </button>
              </Link>
              <Link href="/auth/login" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto px-8 py-4 rounded-xl bg-card/40 backdrop-blur-md border border-border/60 text-foreground font-semibold text-lg hover:bg-accent hover:border-border transition-all flex items-center justify-center">
                  Login to Dashboard
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 relative">
          <div className="absolute inset-0 bg-card/30 backdrop-blur-lg border-y border-border/40" />

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="text-center mb-16 md:mb-24">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Everything you need</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">We've built a robust platform designed specifically to eradicate the stress of manual monthly payments and financial tracking.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {/* Feature 1 */}
              <div className="p-8 rounded-3xl bg-background/50 backdrop-blur-sm border border-border/50 hover:border-primary/40 hover:bg-background/80 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 group">
                <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/5 text-primary rounded-2xl flex items-center justify-center mb-6 border border-primary/20 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                  <IconReceipt size={28} />
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-tight">Consolidated Billing</h3>
                <p className="text-muted-foreground leading-relaxed font-light">Why pay 10 different bills individually? BillSync combines them into one single monthly settlement. Better cashflow, less hassle.</p>
              </div>

              {/* Feature 2 */}
              <div className="p-8 rounded-3xl bg-background/50 backdrop-blur-sm border border-border/50 hover:border-primary/40 hover:bg-background/80 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 group">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500/20 to-green-500/5 text-green-500 rounded-2xl flex items-center justify-center mb-6 border border-green-500/20 group-hover:scale-110 group-hover:bg-green-500/20 transition-all duration-300">
                  <IconClock size={28} />
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-tight">Set & Forget Auto-Pay</h3>
                <p className="text-muted-foreground leading-relaxed font-light">Configure payment rules, set maximum thresholds, and let our Cron-powered engine trigger payments precisely when due.</p>
              </div>

              {/* Feature 3 */}
              <div className="p-8 rounded-3xl bg-background/50 backdrop-blur-sm border border-border/50 hover:border-primary/40 hover:bg-background/80 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 group">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-500 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20 group-hover:scale-110 group-hover:bg-amber-500/20 transition-all duration-300">
                  <IconShieldCheck size={28} />
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-tight">Bank-Grade Security</h3>
                <p className="text-muted-foreground leading-relaxed font-light">Powered by Razorpay. We do not store your sensitive card details directly. All transactions are securely encrypted end-to-end.</p>
              </div>

              {/* Feature 4 */}
              <div className="p-8 rounded-3xl bg-background/50 backdrop-blur-sm border border-border/50 hover:border-primary/40 hover:bg-background/80 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 group">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-purple-500/5 text-purple-500 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-300">
                  <IconChartPie size={28} />
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-tight">Financial Insights</h3>
                <p className="text-muted-foreground leading-relaxed font-light">Monitor your month-over-month utility spending with our beautiful interactive charts and detailed payment breakdowns.</p>
              </div>

              {/* Feature 5 */}
              <div className="p-8 rounded-3xl bg-background/50 backdrop-blur-sm border border-border/50 hover:border-primary/40 hover:bg-background/80 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 group">
                <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 text-cyan-500 rounded-2xl flex items-center justify-center mb-6 border border-cyan-500/20 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all duration-300">
                  <IconWallet size={28} />
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-tight">Multiple Payment Methods</h3>
                <p className="text-muted-foreground leading-relaxed font-light">Use credit cards, debit cards, UPI, or Netbanking. Whatever works best for your cashflow, we completely support it natively.</p>
              </div>

              {/* Feature 6 */}
              <div className="p-8 rounded-3xl bg-background/50 backdrop-blur-sm border border-border/50 hover:border-primary/40 hover:bg-background/80 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 group">
                <div className="w-14 h-14 bg-gradient-to-br from-rose-500/20 to-rose-500/5 text-rose-500 rounded-2xl flex items-center justify-center mb-6 border border-rose-500/20 group-hover:scale-110 group-hover:bg-rose-500/20 transition-all duration-300">
                  <IconBolt size={28} />
                </div>
                <h3 className="text-xl font-bold mb-3 tracking-tight">Instant Alerts</h3>
                <p className="text-muted-foreground leading-relaxed font-light">Receive immediate email notifications the split second a bill is detected, paid, or requires your manual attention.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-32 relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="bg-gradient-to-b from-card/80 to-background border border-border rounded-[2.5rem] p-8 md:p-20 text-center max-w-5xl mx-auto overflow-hidden relative shadow-2xl">
              {/* CTA Effects */}
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none mix-blend-overlay" />

              <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight relative z-10 text-foreground">Stop paying late fees.</h2>
              <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto font-light relative z-10">
                Join thousands of users who have automated their financial lives with BillSync. Setup takes less than two minutes.
              </p>

              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 relative z-10 px-4 sm:px-0">
                <Link href="/auth/signup" className="w-full sm:w-auto">
                  <button className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-foreground text-background font-semibold text-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                    Create your account
                    <IconArrowRight size={20} />
                  </button>
                </Link>
              </div>

              <div className="mt-10 flex justify-center gap-8 text-sm text-muted-foreground relative z-10 font-medium">
                <span className="flex items-center gap-2"><div className="bg-primary/20 p-1 rounded-full"><IconCheck size={14} className="text-primary" /></div> Free to start</span>
                <span className="flex items-center gap-2"><div className="bg-primary/20 p-1 rounded-full"><IconCheck size={14} className="text-primary" /></div> Cancel anytime</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}