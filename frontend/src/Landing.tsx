import { useSmoothScroll } from './hooks/useSmoothScroll';
import { useLaunchApp } from './Root';
import { Header } from './components/sections/Header';
import { Hero } from './components/sections/Hero';
import { Meet } from './components/sections/Meet';
import { Markets } from './components/sections/Markets';
import { Architecture } from './components/sections/Architecture';
import { Risk } from './components/sections/Risk';
import { HowItWorks } from './components/sections/HowItWorks';
import { Surface } from './components/sections/Surface';
import { Faq } from './components/sections/Faq';
import { Closing } from './components/sections/Closing';
import './App.css';

export default function Landing() {
  useSmoothScroll();
  const launch = useLaunchApp();

  return (
    <>
      <Header onLaunch={launch} />
      <main>
        <Hero onLaunch={launch} />
        <Meet />
        <Markets />
        <Architecture />
        <Risk />
        <HowItWorks />
        <Surface />
        <Faq />
      </main>
      <Closing onLaunch={launch} />
    </>
  );
}
