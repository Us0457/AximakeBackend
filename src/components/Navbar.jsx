import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Reordered navItems to match homepage section order
const navItems = [
	{ name: 'Home', path: '/', type: 'route' },
	{ name: 'Support', path: '/support/forum', type: 'route' },
	{ name: 'Services', path: '#fdm-section', type: 'scroll', targetId: 'fdm-section' },
	{ name: 'Testimonials', path: '#testimonials', type: 'scroll', targetId: 'testimonials-section' },
	{ name: 'About Us', path: '#about-us', type: 'scroll', targetId: 'about-us-section' },
	{ name: 'FAQs', path: '#faqs', type: 'scroll', targetId: 'faqs-section' },
	{ name: 'Contact', path: '#contact', type: 'scroll', targetId: 'contact-section' },
];

const Navbar = ({ userIcon }) => {
	const location = useLocation();
	const navigate = useNavigate();
	const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
	const [open, setOpen] = React.useState(false);
	const [activeNav, setActiveNav] = React.useState('Home');

	React.useEffect(() => {
		const handleResize = () => setIsMobile(window.innerWidth < 768);
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	const handleScroll = (targetId, navName) => {
		const element = document.getElementById(targetId);
		if (element) {
			const yOffset = -72; // Adjust this value to match your header height
			const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
			window.scrollTo({ top: y, behavior: 'smooth' });
			setOpen(false);
			setActiveNav(navName);
		}
	};

	// Hamburger icon button
	const Hamburger = (
		<button
			className="md:hidden flex flex-col justify-center items-center w-11 h-11 rounded-full bg-white/90 shadow-lg border border-primary/10 hover:bg-primary/10 transition-all focus:outline-none ml-2"
			aria-label="Open navigation menu"
			onClick={() => setOpen(!open)}
			type="button"
			style={{ zIndex: 51 }}
		>
			<span className={`block w-6 h-0.5 rounded bg-primary mb-1 transition-all duration-300 ${open ? 'rotate-45 translate-y-1.5' : ''}`}></span>
			<span className={`block w-6 h-0.5 rounded bg-primary mb-1 transition-all duration-300 ${open ? 'opacity-0' : ''}`}></span>
			<span className={`block w-6 h-0.5 rounded bg-primary transition-all duration-300 ${open ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
		</button>
	);

	return (
		<>
			{isMobile ? (
				<div className="flex items-center relative">
					{/* Person/User icon comes first on mobile */}
					{userIcon && <div className="mr-1">{userIcon}</div>}
					{Hamburger}
					<AnimatePresence>
						{open && (
							<motion.div
								key="mobile-nav"
								initial={{ opacity: 0, y: -10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								transition={{ duration: 0.18, ease: 'easeInOut' }}
								className="absolute top-14 right-0 w-56 bg-white rounded-xl shadow-2xl border border-primary/10 z-50 flex flex-col py-2"
								style={{ minWidth: 180 }}
							>
								{navItems.map((item) => {
									const isActive = activeNav === item.name;
									return item.type === 'route' ? (
										<Link
											key={item.name}
											to={item.path}
											onClick={() => { setActiveNav(item.name); }}
											className={`block px-6 py-3 rounded-lg text-base font-medium hover:bg-primary/10 hover:text-primary transition-all duration-150 text-left ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
										>
											{item.name}
										</Link>
									) : (
										<a
											key={item.name}
											href={item.path}
											onClick={e => {
												e.preventDefault();
												if (item.name === 'Home' && location.pathname === '/') {
													e.preventDefault();
													window.scrollTo({ top: 0, behavior: 'smooth' });
													setOpen(false);
													setActiveNav(item.name);
												} else {
													handleScroll(item.targetId, item.name);
													setOpen(false);
													setActiveNav(item.name);
												}
											}}
											className={`block px-6 py-3 rounded-lg text-base font-medium hover:bg-primary/10 hover:text-primary transition-all duration-150 text-left ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
										>
											{item.name}
										</a>
									);
								})}
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			) : (
				<nav className="flex items-center gap-x-2">
					{navItems.map((item) => {
						const isActive = activeNav === item.name;
						if (item.type === 'route') {
							if (item.name === 'Home') {
								return (
									<Link
										key={item.name}
										to={item.path}
										onClick={e => {
											if (location.pathname === '/') {
												e.preventDefault();
												window.scrollTo({ top: 0, behavior: 'smooth' });
												setActiveNav(item.name);
											} else {
												setActiveNav(item.name);
											}
										}}
										className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ease-in-out ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
									>
										{item.name}
									</Link>
								);
							} else {
								return (
									<Link
										key={item.name}
										to={item.path}
										onClick={() => { setActiveNav(item.name); }}
										className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ease-in-out ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
									>
										{item.name}
									</Link>
								);
							}
						} else {
							return (
								<a
									key={item.name}
									href={item.path}
									onClick={e => {
										e.preventDefault();
										if (item.name === 'Home' && location.pathname === '/') {
											e.preventDefault();
											window.scrollTo({ top: 0, behavior: 'smooth' });
											setActiveNav(item.name);
										} else {
											handleScroll(item.targetId, item.name);
											setActiveNav(item.name);
										}
									}}
									className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ease-in-out ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
								>
									{item.name}
								</a>
							);
						}
					})}
				</nav>
			)}
		</>
	);
};

export default Navbar;

