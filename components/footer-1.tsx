"use client";
import Image from "next/image";

export default function Footer() {
    return (
        <footer className="w-full bg-gradient-to-b from-[#1B004D] to-[#2E0A6F] text-white">
            <div className="max-w-7xl mx-auto px-6 py-16 flex flex-col items-center">
                <div className="flex items-center space-x-3 mb-6">
                    <Image src="/logo.png" alt="Logo" width={32} height={32} unoptimized priority className="mix-blend-multiply dark:mix-blend-screen" />
                    <p className="font-mono text-lg font-bold">BillSync</p>
                </div>
                <p className="text-center max-w-xl text-sm font-normal leading-relaxed">
                    Empowering creators worldwide with the most advanced AI content creation tools. Transform your ideas
                    into reality.
                </p>
            </div>
            <div className="border-t border-[#3B1A7A]">
                <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm font-normal">
                    <a href="#">BillSync</a> ©2 026. All rights reserved.
                </div>
            </div>
        </footer>
    );
}