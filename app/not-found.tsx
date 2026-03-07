"use client";

import { useRouter } from "next/navigation";
import NotFoundPage from "@/components/page-not-found";
import { useEffect } from "react";
import { Header } from "@/components/header-with-search";
import Footer from "@/components/footer-1";
import Head from "next/head";
export default function NotFound() {
    const router = useRouter();

    useEffect(() => {
        // Add click handlers for the buttons after component mounts
        const handleButtonClicks = () => {
            const buttons = document.querySelectorAll("button");
            buttons.forEach((button) => {
                const buttonText = button.textContent?.trim();
                if (buttonText === "Go Back") {
                    button.onclick = () => router.back();
                } else if (buttonText === "Go Home") {
                    button.onclick = () => router.push("/");
                }
            });
        };

        // Wait for the component to render
        const timer = setTimeout(handleButtonClicks, 1500);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <>
            <Header />
            <NotFoundPage />
            <Footer />
        </>
    );
}
