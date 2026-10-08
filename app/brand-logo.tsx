'use client';
import {useEffect, useState} from 'react';
import {useTheme} from 'next-themes';
import {themeBrand} from '../lib/theme-brand';
import './brand-logo.css';

export default function BrandLogo() {
  const {theme} = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const brand = themeBrand(mounted && theme === 'wuxia' ? 'wuxia' : 'classic');
  return <span className="brand-logo" aria-hidden="true">
    <img src={brand.logo} width={48} height={48} alt=""/>
  </span>;
}
