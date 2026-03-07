'use client';

import React from 'react';
import { MenuIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetFooter } from '@/components/sheet';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThemeSwitch } from '@/components/ui/theme-switch-button';
import Link from 'next/link';
import Image from 'next/image';

export function Header() {
	const [open, setOpen] = React.useState(false);
	const [scrolled, setScrolled] = React.useState(false);
	const [hidden, setHidden] = React.useState(false);
	const lastScrollY = React.useRef(0);

	React.useEffect(() => {
		const handleScroll = () => {
			const currentY = window.scrollY;
			const delta = currentY - lastScrollY.current;

			setScrolled(currentY > 10);

			if (currentY <= 80) {
				// Always visible near the top
				setHidden(false);
			} else if (delta > 8) {
				// Scrolled down by at least 8px → hide
				setHidden(true);
				lastScrollY.current = currentY;
			} else if (delta < -8) {
				// Scrolled up by at least 8px → show
				setHidden(false);
				lastScrollY.current = currentY;
			}
			// Ignore tiny jitter in between
		};
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	const links = [
		{ label: 'Home', href: '/' },
		{ label: 'About', href: '#about' },
		{ label: 'Login', href: '/login' },
		{ label: 'Signup', href: '/signup' },
	];

	return (
		<header
			className={cn(
				'sticky top-0 z-50 w-full',
				'transition-[transform,background-color,box-shadow,border-color] duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
				hidden ? '-translate-y-full' : 'translate-y-0',
				scrolled
					? [
						'border-b border-purple-500/20',
						'bg-background/80 backdrop-blur-xl',
						'shadow-[0_4px_24px_-4px_rgba(168,85,247,0.25)]',
					]
					: [
						'border-b border-transparent',
						'bg-background/40 backdrop-blur-md',
					],
			)}
		>
			<nav
				className={cn(
					'mx-auto flex w-full max-w-4xl items-center justify-between px-4 transition-all duration-300 ease-in-out',
					scrolled ? 'h-12' : 'h-14',
				)}
			>
				{/* Logo */}
				<div
					className={cn(
						'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-all duration-300',
						'hover:shadow-md hover:scale-105',
					)}
				>
					<Link href="/" className="flex items-center gap-2">
						<Image
							src="/logo.png"
							alt="Logo"
							width={scrolled ? 26 : 32}
							height={scrolled ? 26 : 32}
							unoptimized
							priority
							className="mix-blend-multiply dark:mix-blend-screen transition-all duration-300"
						/>
						<p
							className={cn(
								'font-mono font-bold transition-all duration-300',
								scrolled ? 'text-base' : 'text-lg',
							)}
						>
							BillSync
						</p>
					</Link>
				</div>

				{/* Right side */}
				<div className="flex items-center gap-2">
					<div className="hidden items-center gap-1 lg:flex">
						{links.map((link) => (
							<Link
								key={link.label}
								className={cn(
									buttonVariants({ variant: 'ghost' }),
									'transition-all duration-300',
									scrolled ? 'text-sm h-8 px-3' : '',
								)}
								href={link.href}
							>
								{link.label}
							</Link>
						))}
					</div>

					{/* Theme Toggle */}
					<ThemeSwitch />

					{/* Mobile menu */}
					<Sheet open={open} onOpenChange={setOpen}>
						<Button
							size="icon"
							variant="outline"
							onClick={() => setOpen(!open)}
							className="lg:hidden"
						>
							<MenuIcon className="size-4" />
						</Button>
						<SheetContent
							className="bg-background/95 supports-[backdrop-filter]:bg-background/80 gap-0 backdrop-blur-lg"
							showClose={false}
							side="left"
						>
							<div className="grid gap-y-2 overflow-y-auto px-4 pt-12 pb-5">
								{links.map((link) => (
									<Link
										key={link.label}
										className={buttonVariants({
											variant: 'ghost',
											className: 'justify-start',
										})}
										href={link.href}
									>
										{link.label}
									</Link>
								))}
							</div>
							<SheetFooter>
								<Button variant="outline">Sign In</Button>
								<Button>Get Started</Button>
							</SheetFooter>
						</SheetContent>
					</Sheet>
				</div>
			</nav>
		</header>
	);
}
