import type { SVGProps } from 'react';

type IconName = 'search' | 'plus' | 'image' | 'pen' | 'offline' | 'cloud-check' | 'refresh' | 'sort' | 'x' | 'trash' | 'pin';
const paths: Record<IconName, React.ReactNode> = {
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.3"/><path d="m3 17 5-5 4 4 4-6 5 7"/></>,
  pen: <path d="m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-4-4L5 15l-1 5Z"/>,
  'cloud-check': <><path d="M7 18H6a4.5 4.5 0 0 1-.5-9 6.5 6.5 0 0 1 12.4-1.5A5.2 5.2 0 0 1 20 17"/><path d="m10 16 3 3 5-6"/></>,
  offline: <><path d="m3 3 18 18M7 18H6a4.5 4.5 0 0 1-1.6-8.7M9 4a6.5 6.5 0 0 1 9 3.5A5.2 5.2 0 0 1 21 15M9 18h5"/></>,
  refresh: <><path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/></>,
  sort: <path d="M5 5v14m-3-3 3 3 3-3M12 6h9m-9 6h6m-6 6h3"/>,
  x: <path d="m6 6 12 12M6 18 18 6"/>,
  trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>,
  pin: <><path d="M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6Z"/><path d="M12 15v6"/></>,
};
export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
