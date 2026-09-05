import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  type?: string;
  url?: string;
  image?: string;
  children?: React.ReactNode;
}

const DEFAULT_OG_IMAGE = 'https://www.zilkakotab.com/img/logo.png';

export function SEO({ 
  title, 
  description, 
  type = 'website', 
  url,
  image = DEFAULT_OG_IMAGE,
  children 
}: SEOProps) {
  const siteName = 'Zilka-Kotab PC';
  const fullTitle = title === 'Home' ? siteName : `${title} | ${siteName}`;
  const currentUrl = url ? `https://www.zilkakotab.com${url}` : 'https://www.zilkakotab.com';
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={currentUrl} />
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:image" content={image} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {children}
    </Helmet>
  );
}