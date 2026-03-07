
"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AnimatedCharacters } from "@/components/animated-characters";
import { LoginForm } from "@/components/login-form";
import { Header } from "@/components/header-with-search";
import Footer from "@/components/footer-1";

export default function LoginPage() {
    const [formState, setFormState] = useState({
        isTyping: false,
        showPassword: false,
        password: "",
    });

    return (
        <>
            <Header />
            <div className="min-h-screen grid lg:grid-cols-2">
                {/* Left Content Section */}
                <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary/90 via-primary to-primary/80 dark:from-primary/50 dark:via-primary/30 dark:to-primary/40 p-12 text-primary-foreground">

                    <div className="relative z-20 flex items-end justify-center h-[500px]">
                        {/* Cartoon Characters */}
                        <AnimatedCharacters
                            isTyping={formState.isTyping}
                            showPassword={formState.showPassword}
                            hasPassword={formState.password.length > 0}
                        />
                    </div>
                    {/* Decorative elements */}
                    <div className="absolute inset-0 bg-grid-white/[0.05] dark:bg-grid-white/[0.02] bg-[size:20px_20px]" />
                    <div className="absolute top-1/4 right-1/4 size-64 bg-primary-foreground/10 dark:bg-primary-foreground/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-1/4 left-1/4 size-96 bg-primary-foreground/5 dark:bg-primary-foreground/3 rounded-full blur-3xl" />
                </div>

                {/* Right Login Section */}
                <div className="flex items-center justify-center p-8 bg-background">
                    <LoginForm onStateChange={setFormState} />
                </div>
            </div>
            <Footer />
        </>
    );
}