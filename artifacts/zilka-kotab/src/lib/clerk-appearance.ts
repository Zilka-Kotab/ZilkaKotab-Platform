import { shadcn } from '@clerk/themes';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
export const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'top' as const,
  },
  variables: {
    colorPrimary: '#224d77',
    colorForeground: '#142c40',
    colorMutedForeground: '#526171',
    colorDanger: '#b42332',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#142c40',
    colorNeutral: '#142c40',
    fontFamily: '"DM Sans", sans-serif',
    borderRadius: '0.65rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'w-[440px] max-w-full bg-white border border-slate-200 shadow-xl rounded-xl',
    card: '!bg-transparent shadow-none',
    footer: '!bg-transparent',
    headerTitle: 'text-slate-900',
    headerSubtitle: 'text-slate-600',
    socialButtonsBlockButtonText: 'text-slate-900',
    formFieldLabel: 'text-slate-800',
    formButtonPrimary: 'text-white',
    footerActionLink: 'text-blue-800',
    footerActionText: 'text-slate-600',
    dividerText: 'text-slate-600',
  },
};
