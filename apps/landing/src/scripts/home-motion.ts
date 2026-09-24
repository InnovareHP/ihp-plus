import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

const all = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = document) =>
  Array.from(scope.querySelectorAll<T>(selector))
const one = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = document) =>
  scope.querySelector<T>(selector)

type Cleanup = () => void

/** Plays once as the element scrolls into view. */
const onEnter = (trigger: Element, start = 'top 82%'): ScrollTrigger.Vars => ({
  trigger,
  start,
  toggleActions: 'play none none none',
})

function splitWords(element: HTMLElement) {
  const split = SplitText.create(element, {
    type: 'words',
    mask: 'words',
    wordsClass: 'motion-word',
    aria: 'none',
  })
  // Transformed words drop out of a parent's background-clip, so each gradient word paints its own.
  for (const gradient of all('.text-brand-gradient', element)) {
    gradient.classList.remove('text-brand-gradient')
    for (const word of all('.motion-word', gradient)) word.classList.add('text-brand-gradient')
  }
  return split
}

function hero() {
  const section = one('.hero')
  if (!section) return
  const heading = one('#hero-heading', section)
  const kicker = one('[data-hero="kicker"]', section)
  const copy = one('[data-hero="copy"]', section)
  if (!heading || !kicker || !copy) return

  // The kicker splits into letters, so the heading carries its name as one phrase.
  heading.setAttribute('aria-label', 'Powered by possibilities')
  const letters = SplitText.create(kicker, { type: 'chars', mask: 'chars', aria: 'none' })
  const words = SplitText.create(copy, { type: 'words', aria: 'none' })

  gsap
    .timeline({ defaults: { ease: 'expo.out', duration: 1.2 } })
    .from(all('.hero-photo', section), { scale: 1.22, duration: 2.4, ease: 'power3.out' }, 0)
    .from(all('[data-site-nav] > ul > li'), { y: -24, autoAlpha: 0, stagger: 0.07 }, 0.2)
    .from(
      '[data-hero="logo"]',
      { scale: 0.3, rotation: -24, autoAlpha: 0, ease: 'back.out(2.2)' },
      0.35,
    )
    .from(letters.chars, { yPercent: 115, rotationX: -90, stagger: 0.035, duration: 1 }, 0.5)
    .fromTo(
      '[data-hero="title"]',
      { clipPath: 'inset(0% 50% 0% 50%)', letterSpacing: '0.35em', filter: 'blur(14px)' },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        letterSpacing: '0.02em',
        filter: 'blur(0px)',
        duration: 1.6,
      },
      0.75,
    )
    .from(
      words.words,
      { y: 18, autoAlpha: 0, filter: 'blur(6px)', stagger: 0.018, duration: 0.9 },
      1.2,
    )
    .from('.hero-badge', { scale: 0, rotation: -200, autoAlpha: 0, ease: 'back.out(1.6)' }, 1.4)
  // Every intro target now holds its start state inline, so the head script's pre-hide can go.
  document.documentElement.classList.remove('motion')

  // The copy lifts away as the page scrolls, so the photo reads as the deeper layer.
  gsap.to('.hero-content', {
    yPercent: -18,
    opacity: 0.25,
    ease: 'none',
    scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true },
  })
}

function heroBackdrop(canHover: boolean, cleanups: Cleanup[]) {
  const section = one('.hero')
  const backdrop = section && one('.backdrop', section)
  if (!section || !backdrop) return
  gsap.from(backdrop, { autoAlpha: 0, duration: 2.4, delay: 0.6, ease: 'power2.out' })
  if (!canHover) return

  // The light trails the pointer a little, so the backdrop reads as a layer behind the copy.
  const layers = all('[data-depth]', backdrop).map((layer) => ({
    depth: Number(layer.dataset.depth),
    x: gsap.quickTo(layer, 'x', { duration: 1.2, ease: 'power3' }),
    y: gsap.quickTo(layer, 'y', { duration: 1.2, ease: 'power3' }),
  }))
  const follow = (event: PointerEvent) => {
    const box = section.getBoundingClientRect()
    const dx = (event.clientX - box.left) / box.width - 0.5
    const dy = (event.clientY - box.top) / box.height - 0.5
    for (const layer of layers) {
      layer.x(dx * layer.depth)
      layer.y(dy * layer.depth)
    }
  }
  const settle = () => {
    for (const layer of layers) {
      layer.x(0)
      layer.y(0)
    }
  }
  section.addEventListener('pointermove', follow)
  section.addEventListener('pointerleave', settle)
  cleanups.push(() => {
    section.removeEventListener('pointermove', follow)
    section.removeEventListener('pointerleave', settle)
  })
}

function headings() {
  for (const heading of all('[data-motion="heading"]')) {
    const split = splitWords(heading)
    gsap.from(split.words, {
      yPercent: 120,
      rotation: 6,
      transformOrigin: '0% 100%',
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.07,
      scrollTrigger: onEnter(heading),
    })
  }
}

function eyebrows() {
  for (const eyebrow of all('[data-motion="eyebrow"]')) {
    const flag = one('img', eyebrow)
    gsap
      .timeline({ scrollTrigger: onEnter(eyebrow, 'top 88%') })
      .fromTo(
        eyebrow,
        { clipPath: 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power4.inOut' },
      )
      .from(flag, { xPercent: -120, rotation: -30, duration: 0.8, ease: 'back.out(2)' }, 0.2)
  }
}

function fades() {
  for (const element of all('[data-motion="fade"]')) {
    gsap.from(element, {
      y: 36,
      autoAlpha: 0,
      filter: 'blur(8px)',
      duration: 1.1,
      delay: 0.15,
      ease: 'power3.out',
      scrollTrigger: onEnter(element, 'top 90%'),
    })
  }
}

function whoWeAre() {
  const section = one('#about')
  if (!section) return
  const scrub = { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 1.2 }
  gsap.fromTo(
    one('.who-swirl-left img', section),
    { xPercent: -45, rotation: -60, autoAlpha: 0 },
    {
      xPercent: 0,
      rotation: 0,
      autoAlpha: 1,
      ease: 'power2.out',
      scrollTrigger: { ...scrub, end: 'center center' },
    },
  )
  gsap.to(one('.who-swirl-right img', section), {
    yPercent: 40,
    rotation: 25,
    ease: 'none',
    scrollTrigger: scrub,
  })

  const diamond = one('.who-diamond', section)
  gsap
    .timeline({ scrollTrigger: onEnter(section, 'bottom 95%') })
    .from(diamond, { y: -90, rotation: 180, autoAlpha: 0, duration: 1.4, ease: 'bounce.out' })
    .to(diamond, { y: 10, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1 })
}

function whatWeDo(canHover: boolean, cleanups: Cleanup[]) {
  const section = one('.services')
  if (!section) return

  gsap.fromTo(
    one('.services-bg', section),
    { scale: 1.25, yPercent: -6 },
    {
      scale: 1,
      yPercent: 6,
      ease: 'none',
      scrollTrigger: { trigger: section, scrub: true, start: 'top bottom', end: 'bottom top' },
    },
  )

  // Each card swings in from its own side, like panels hinged on the middle one.
  const entrances: gsap.TweenVars[] = [
    { x: -120, rotationY: 45, rotationZ: -4 },
    { y: 160, rotationX: -40 },
    { x: 120, rotationY: -45, rotationZ: 4 },
  ]
  all('.service-card', section).forEach((card, index) => {
    const photo = one('.service-card__photo', card)
    gsap.set(card, { transformPerspective: 1100 })
    gsap
      .timeline({ scrollTrigger: onEnter(card, 'top 88%'), delay: index * 0.14 })
      .from(card, {
        ...entrances[index % entrances.length],
        autoAlpha: 0,
        duration: 1.3,
        ease: 'expo.out',
      })
      .fromTo(
        photo,
        { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power4.inOut' },
        0.35,
      )
      .from(one('img', photo ?? card), { scale: 1.4, duration: 1.4, ease: 'power3.out' }, 0.35)
      .from(
        all('.service-card__title, .service-card__body', card),
        { y: 24, autoAlpha: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out' },
        0.5,
      )
      .from(
        one('.service-card__arrow', card),
        { scale: 0, rotation: -135, duration: 0.9, ease: 'back.out(2.4)' },
        0.8,
      )

    if (!canHover) return
    const tiltX = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' })
    const tiltY = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' })
    const tilt = (event: PointerEvent) => {
      const box = card.getBoundingClientRect()
      tiltY(((event.clientX - box.left) / box.width - 0.5) * 14)
      tiltX(((event.clientY - box.top) / box.height - 0.5) * -14)
    }
    const settle = () => {
      tiltX(0)
      tiltY(0)
    }
    card.addEventListener('pointermove', tilt)
    card.addEventListener('pointerleave', settle)
    cleanups.push(() => {
      card.removeEventListener('pointermove', tilt)
      card.removeEventListener('pointerleave', settle)
    })
  })
}

function whyIhp(cleanups: Cleanup[]) {
  const section = one('.why')
  if (!section) return
  all('[data-motion="stat"]', section).forEach((stat, index) => {
    const value = one('[data-stat-value]', stat)
    const target = Number(value?.textContent?.trim())
    const counter = { value: 0 }
    const timeline = gsap
      .timeline({ scrollTrigger: onEnter(stat, 'top 88%'), delay: index * 0.15 })
      .fromTo(
        stat,
        { clipPath: 'inset(100% 0% 0% 0% round 15px)', y: 80 },
        { clipPath: 'inset(0% 0% 0% 0% round 15px)', y: 0, duration: 1.2, ease: 'expo.inOut' },
      )
      .from(
        one('[data-stat-unit]', stat),
        { scale: 0, rotation: 35, transformOrigin: '0% 100%', duration: 0.8, ease: 'back.out(3)' },
        1,
      )
      .from(
        one('figcaption', stat),
        { y: 20, autoAlpha: 0, duration: 0.8, ease: 'power3.out' },
        0.9,
      )

    // The figure is aria-hidden and the caption repeats the value, so counting is purely visual.
    if (value && Number.isFinite(target)) {
      cleanups.push(() => {
        value.textContent = String(target)
      })
      timeline.fromTo(
        counter,
        { value: 0 },
        {
          value: target,
          duration: 1.8,
          ease: 'power3.out',
          onUpdate: () => {
            value.textContent = String(Math.round(counter.value))
          },
        },
        0.5,
      )
    }
  })
}

function globalReach() {
  const section = one('#global-reach')
  if (!section) return
  gsap.fromTo(
    one('.global-art', section),
    { scale: 1.3, rotation: -6 },
    {
      scale: 1,
      rotation: 0,
      ease: 'none',
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'center center', scrub: 1 },
    },
  )

  // The kicker is aria-hidden, so splitting it into letters costs screen readers nothing.
  const kicker = one('[data-global-kicker]', section)
  if (kicker) {
    const letters = SplitText.create(kicker, { type: 'chars', aria: 'none' })
    gsap.from(letters.chars, {
      autoAlpha: 0,
      scale: 2.4,
      filter: 'blur(12px)',
      stagger: { each: 0.05, from: 'center' },
      duration: 1.2,
      ease: 'expo.out',
      scrollTrigger: onEnter(kicker, 'top 80%'),
    })
  }
  gsap.from(one('.global-diamond', section), {
    y: -140,
    rotation: 360,
    autoAlpha: 0,
    duration: 1.6,
    delay: 0.4,
    ease: 'bounce.out',
    scrollTrigger: onEnter(section, 'top 70%'),
  })
}

function industries() {
  const section = one('.industries')
  if (!section) return
  const lean = one('.marquee-lean', section)
  if (!lean) return
  // The strip leans as one piece; skewing each run apart opens a slanted gap at their seam.
  const setSkew = gsap.quickSetter(lean, 'skewX', 'deg')
  const clamp = gsap.utils.clamp(-14, 14)
  const proxy = { skew: 0 }

  // Fast scrolling leans the ticker into the motion; it settles back once the page stops.
  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      const skew = clamp(self.getVelocity() / -250)
      if (Math.abs(skew) <= Math.abs(proxy.skew)) return
      proxy.skew = skew
      gsap.to(proxy, {
        skew: 0,
        duration: 0.9,
        ease: 'power3',
        overwrite: true,
        onUpdate: () => setSkew(proxy.skew),
      })
    },
  })
  gsap.to(all('.marquee img', section), {
    rotation: 360,
    ease: 'none',
    scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
  })
  gsap.fromTo(
    one('#industries-heading', section),
    { letterSpacing: '0.6em', autoAlpha: 0 },
    {
      letterSpacing: '0.05em',
      autoAlpha: 1,
      duration: 1.4,
      ease: 'expo.out',
      scrollTrigger: onEnter(section, 'top 85%'),
    },
  )
}

function howWeWork() {
  const section = one('.how')
  if (!section) return
  gsap.fromTo(
    one('.how-ribbon', section),
    { clipPath: 'inset(0% 100% 0% 0%)' },
    {
      clipPath: 'inset(0% 0% 0% 0%)',
      ease: 'none',
      scrollTrigger: { trigger: section, start: 'top 75%', end: 'center center', scrub: 1 },
    },
  )

  // The steps are dealt onto the table one at a time, alternating their tilt.
  const cards = all('.step-card', section)
  gsap
    .timeline({ scrollTrigger: onEnter(cards[0] ?? section, 'top 85%') })
    .from(cards, {
      y: 180,
      rotation: (index: number) => (index % 2 ? 14 : -14),
      autoAlpha: 0,
      transformOrigin: '50% 100%',
      stagger: 0.14,
      duration: 1.1,
      ease: 'back.out(1.5)',
    })
    .from(
      cards.map((card) => one('.step-card-badge', card)),
      { scale: 0, rotation: -360, stagger: 0.14, duration: 0.9, ease: 'back.out(2.5)' },
      0.45,
    )
}

function contact() {
  const section = one('#contact')
  if (!section) return
  gsap.to(one('.contact-lines', section), {
    yPercent: -25,
    rotation: 8,
    ease: 'none',
    scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 1 },
  })
  gsap
    .timeline({ scrollTrigger: onEnter(section, 'top 70%') })
    .from(one('.contact-bubble-shape', section), {
      scale: 0.35,
      rotation: -14,
      autoAlpha: 0,
      transformOrigin: '60% 50%',
      duration: 1.6,
      ease: 'elastic.out(1, 0.65)',
    })
    .from(
      one('.contact-form', section),
      { y: 50, autoAlpha: 0, duration: 1, ease: 'power3.out' },
      0.35,
    )
    .from(
      one('.contact-badge', section),
      { scale: 0, rotation: -270, autoAlpha: 0, duration: 1.2, ease: 'back.out(1.8)' },
      0.5,
    )
}

const motion = gsap.matchMedia()
motion.add(
  {
    animate: '(prefers-reduced-motion: no-preference)',
    canHover: '(hover: hover) and (pointer: fine)',
  },
  (context) => {
    if (!context.conditions?.animate) return
    const cleanups: Cleanup[] = []
    hero()
    heroBackdrop(Boolean(context.conditions.canHover), cleanups)
    headings()
    eyebrows()
    fades()
    whoWeAre()
    whatWeDo(Boolean(context.conditions.canHover), cleanups)
    whyIhp(cleanups)
    globalReach()
    industries()
    howWeWork()
    contact()
    return () => cleanups.forEach((cleanup) => cleanup())
  },
)
