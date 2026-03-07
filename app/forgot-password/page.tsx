"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/header-with-search";
import Footer from "@/components/footer-1";
import { AnimatedCharacters } from "@/components/animated-characters";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isTyping, setIsTyping] = useState(false);

    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                setIsSubmitted(true);
            } else {
                setError(data.error || 'Failed to send new password');
            }
        } catch (error) {
            setError('Network error. Please try again.');
            console.error('Forgot password error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Header />
            <div className="min-h-screen grid lg:grid-cols-2">
                {/* Left Content Section */}
                <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary/90 via-primary to-primary/80 dark:from-primary/50 dark:via-primary/30 dark:to-primary/40 p-12 text-primary-foreground">
                    <div className="relative z-20 flex items-end justify-center h-[500px]">
                        {/* Cartoon Characters */}
                        <AnimatedCharacters
                            isTyping={isTyping}
                            showPassword={false}
                            hasPassword={false}
                        />
                    </div>
                    {/* Decorative elements */}
                    <div className="absolute inset-0 bg-grid-white/[0.05] dark:bg-grid-white/[0.02] bg-[size:20px_20px]" />
                    <div className="absolute top-1/4 right-1/4 size-64 bg-primary-foreground/10 dark:bg-primary-foreground/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-1/4 left-1/4 size-96 bg-primary-foreground/5 dark:bg-primary-foreground/3 rounded-full blur-3xl" />
                </div>

                {/* Right Form Section */}
                <div className="flex items-center justify-center p-8 bg-background">
                    <div className="w-full max-w-[420px]">
                        {!isSubmitted ? (
                            <>
                                {/* Back to Login */}
                                <Link
                                    href="/login"
                                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
                                >
                                    <ArrowLeft className="size-4" />
                                    Back to login
                                </Link>

                                {/* Header */}
                                <div className="text-center mb-10">
                                    <h1 className="text-3xl font-bold tracking-tight mb-2">Forgot password?</h1>
                                    <p className="text-muted-foreground text-sm">
                                        No worries, we'll send you a new password via email.
                                    </p>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="anna@gmail.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onFocus={() => setIsTyping(true)}
                                            onBlur={() => setIsTyping(false)}
                                            required
                                            className="h-12 bg-background border-border/60 focus:border-primary"
                                        />
                                    </div>

                                    {error && (
                                        <div className="p-3 text-sm text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg mb-5">
                                            {error}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        className="w-full h-12 text-base font-medium"
                                        size="lg"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? "Sending..." : "Send new password"}
                                    </Button>
                                </form>

                                {/* Back to Login Link */}
                                <div className="text-center text-sm text-muted-foreground mt-8">
                                    Remember your password?{" "}
                                    <Link href="/login" className="text-foreground font-medium hover:underline">
                                        Log in
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Success State */}
                                <div className="text-center">
                                    <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                                        <Mail className="size-8 text-primary" />
                                    </div>

                                    <h1 className="text-3xl font-bold tracking-tight mb-2">Check your email</h1>
                                    <p className="text-muted-foreground text-sm mb-8">
                                        We sent your new password to<br />
                                        <span className="font-medium text-foreground">{email}</span>
                                    </p>

                                    <Button
                                        onClick={() => window.location.href = 'mailto:'}
                                        variant="outline"
                                        className="w-full h-12 text-base font-medium mb-4"
                                        size="lg"
                                    >
                                        Open email app
                                    </Button>

                                    <div className="text-sm text-muted-foreground">
                                        Didn't receive the email?{" "}
                                        <button
                                            onClick={() => setIsSubmitted(false)}
                                            className="text-foreground font-medium hover:underline"
                                        >
                                            Click to resend
                                        </button>
                                    </div>

                                    <div className="mt-8">
                                        <Link
                                            href="/login"
                                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ArrowLeft className="size-4" />
                                            Back to login
                                        </Link>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
}
