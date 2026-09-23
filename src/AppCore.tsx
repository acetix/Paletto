import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Copy, ImagePlus, LockKeyhole, Pipette, RotateCcw, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, Upload, X } from 'lucide-react'
import './steps.css'
import './preset-gallery.css'
import './dropzone.css'
import './share.css'

type Swatch = { hex: string; name: string }
type SavedPalette = { id: number; date: string; colors: Swatch[]; image: string; title: string }
type ExportFormat = 'CSS' | 'Tailwind' | 'SCSS'
const starterColors = ['#F3A27E', '#E65F39', '#435BC3', '#ACA1E8', '#728346', '#F5D2BA', '#27345E', '#B74763', '#D3A745', '#4B7F78', '#D78C53', '#F4E8D7']
const presetImages = [
  { title: 'Citrus hour', src: '/images/library-citrus.jpg' },
  { title: 'Wild bloom', src: '/images/library-flowers.jpg' },
  { title: 'Blue tide', src: '/images/library-ocean.jpg' },
  { title: 'Dune glow', src: '/images/library-desert.jpg' },
  { title: 'Leaf study', src: '/images/library-botanical.jpg' },
  { title: 'Colour study', src: '/images/library-abstract.jpg' },
  { title: 'Mountain air', src: '/images/library-mountain.jpg' },
  { title: 'Petal & porcelain', src: '/images/library-stilllife.jpg' },
  { title: 'Coffee break', src: '/images/library-coffee.jpg' },
  { title: 'Sunday still life', src: '/images/palette-still-life.png' },
]

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0, s = 0
  const l = (max + min) / 2
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360 }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}
function rgbToOklch(r: number, g: number, b: number) {
  const linear = (v: number) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }
  const red = linear(r), green = linear(g), blue = linear(b)
  const l = Math.cbrt(.4122214708 * red + .5363325363 * green + .0514459929 * blue)
  const m = Math.cbrt(.2119034982 * red + .6806995451 * green + .1073969566 * blue)
  const s = Math.cbrt(.0883024619 * red + .2817188376 * green + .6299787005 * blue)
  const light = .2104542553 * l + .793617785 * m - .0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s
  const bAxis = .0259040371 * l + .7827717662 * m - .808675766 * s
  return { l: Math.round(light * 100), c: Math.round(Math.hypot(a, bAxis) * 100), h: (Math.round(Math.atan2(bAxis, a) * 180 / Math.PI) + 360) % 360 }
}
function oklchToHex(lightness: number, chroma: number, hue: number) {
  const angle = hue * Math.PI / 180, a = chroma / 100 * Math.cos(angle), b = chroma / 100 * Math.sin(angle)
  const l = (lightness / 100) + .3963377774 * a + .2158037573 * b
  const m = (lightness / 100) - .1055613458 * a - .0638541728 * b
  const s = (lightness / 100) - .0894841775 * a - 1.291485548 * b
  const ll = l ** 3, mm = m ** 3, ss = s ** 3
  const gamma = (v: number) => { const c = v <= .0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - .055; return Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0') }
  return `#${gamma(4.0767416621 * ll - 3.3077115913 * mm + .2309699292 * ss)}${gamma(-1.2684380046 * ll + 2.6097574011 * mm - .3413193965 * ss)}${gamma(-.0041960863 * ll - .7034186147 * mm + 1.707614701 * ss)}`.toUpperCase()
}
function colorName(hex: string, index: number) {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
  const hsl = rgbToHsl(channels[0], channels[1], channels[2])
  const names = ['rose', 'coral', 'orange', 'amber', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'magenta']
  if (hsl.l < 14) return 'Deep ink'
  if (hsl.l > 89) return 'Soft ivory'
  if (hsl.s < 17) return ['Stone', 'Mist', 'Pebble', 'Cloud', 'Ash', 'Dove'][index % 6]
  return `Soft ${names[Math.round(hsl.h / 30) % 12]}`
}
const toSwatches = (values: string[]) => values.map((hex, i) => ({ hex, name: colorName(hex, i) }))
function readSharedPalette() {
  const value = new URLSearchParams(window.location.search).get('palette')
  if (!value) return null
  const colors = value.split(',').map((hex) => hex.replace(/^#/, ''))
  if (colors.length < 5 || colors.length > 12 || colors.some((hex) => !/^[\da-f]{6}$/i.test(hex))) return null
  return toSwatches(colors.map((hex) => `#${hex.toUpperCase()}`))
}
function luminance(hex: string) {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
}
function contrast(a: string, b: string) { const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (light + .05) / (dark + .05) }
function extractPalette(image: HTMLImageElement, count: number): Swatch[] {
  const canvas = document.createElement('canvas'), size = 100
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return toSwatches(starterColors).slice(0, count)
  ctx.drawImage(image, 0, 0, size, size)
  const pixels = ctx.getImageData(0, 0, size, size).data, points: number[][] = []
  for (let i = 0; i < pixels.length; i += 16) if (pixels[i + 3] > 180) points.push([pixels[i], pixels[i + 1], pixels[i + 2]])
  const stride = Math.max(1, Math.floor(points.length / 800)), sample = points.filter((_, i) => i % stride === 0)
  const centers = Array.from({ length: count }, (_, i) => [...(sample[Math.floor((i + .5) * sample.length / count)] || [120, 120, 120])])
  for (let pass = 0; pass < 12; pass++) {
    const sums = centers.map(() => [0, 0, 0, 0])
    sample.forEach((p) => { let best = 0, distance = Infinity; centers.forEach((c, i) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < distance) { distance = d; best = i } }); sums[best][0] += p[0]; sums[best][1] += p[1]; sums[best][2] += p[2]; sums[best][3]++ })
    centers.forEach((_, i) => { if (sums[i][3]) centers[i] = sums[i].slice(0, 3).map((v) => Math.round(v / sums[i][3])) })
  }
  const colors = centers.map((rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`.toUpperCase()).sort((a, b) => luminance(b) - luminance(a))
  return toSwatches(colors)
}

export default function AppCore() {
  const fileInput = useRef<HTMLInputElement>(null)
  const sharedPalette = readSharedPalette()
  const [image, setImage] = useState(''), [imageLabel, setImageLabel] = useState(sharedPalette ? 'Shared palette' : '')
  const [swatches, setSwatches] = useState(() => sharedPalette || toSwatches(starterColors)), [count, setCount] = useState(sharedPalette?.length || 12), [active, setActive] = useState(0)
  const [format, setFormat] = useState<ExportFormat>('CSS'), [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState<SavedPalette[]>(() => { try { return JSON.parse(localStorage.getItem('paletto-history') || '[]') as SavedPalette[] } catch { return [] } })
  const [foreground, setForeground] = useState(0), [background, setBackground] = useState(2), [toast, setToast] = useState(''), [dragging, setDragging] = useState(false)
  useEffect(() => { localStorage.setItem('paletto-history', JSON.stringify(saved.slice(0, 8))) }, [saved])
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); fileInput.current?.click() } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [])
  const selected = swatches[active] || swatches[0]
  const oklch = useMemo(() => { const c = [1, 3, 5].map((at) => parseInt(selected.hex.slice(at, at + 2), 16)); return rgbToOklch(c[0], c[1], c[2]) }, [selected])
  const ratio = useMemo(() => contrast(swatches[foreground]?.hex || '#fff', swatches[background]?.hex || '#111'), [swatches, foreground, background])
  const text = useMemo(() => {
    if (format === 'Tailwind') return `// tailwind.config.js\nexport default {\n  theme: {\n    extend: {\n      colors: {\n${swatches.map((s, i) => `        'palette-${i + 1}': '${s.hex}',`).join('\n')}\n      }\n    }\n  }\n}`
    const isCss = format === 'CSS'
    return `${isCss ? ':root {' : '$palette: ('}\n${swatches.map((s, i) => isCss ? `  --palette-${i + 1}: ${s.hex};` : `  'palette-${i + 1}': ${s.hex}${i < swatches.length - 1 ? ',' : ''}`).join('\n')}\n${isCss ? '}' : ');'}`
  }, [format, swatches])
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(''), 2400) }
  function loadPreset(src: string, title: string) {
    const img = new Image()
    img.onload = () => { setImage(src); setImageLabel(title); setSwatches(extractPalette(img, count)); setActive(0); setForeground(0); setBackground(Math.min(2, count - 1)); notify(`Palette made from ${title}.`) }
    img.onerror = () => notify('Could not load that image. Please try another.')
    img.src = src
  }
  function loadFile(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { notify('Choose an image file to make a palette.'); return }
    const url = URL.createObjectURL(file), img = new Image()
    img.onload = () => {
      const palette = extractPalette(img, count)
      const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      setImage(ctx ? canvas.toDataURL('image/jpeg', .78) : url)
      setImageLabel(file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Your image'); setSwatches(palette); setActive(0); setForeground(0); setBackground(Math.min(2, count - 1)); notify('Fresh palette, just for you.')
      URL.revokeObjectURL(url)
    }
    img.onerror = () => notify('That image could not be opened. Try another one.')
    img.src = url
  }
  function regenerate() { const img = new Image(); img.onload = () => { setSwatches(extractPalette(img, count)); setActive(0); notify('A fresh take on your image.') }; img.onerror = () => notify('Could not refresh this image.'); img.src = image }
  function savePalette() {
    const entry = { id: Date.now(), date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), colors: [...swatches], image, title: imageLabel }
    setSaved((items) => [entry, ...items.filter((item) => item.title !== imageLabel)].slice(0, 8)); notify('Saved to your palette history.')
  }
  function adjust(field: 'h' | 'c' | 'l', value: number) {
    const next = { ...oklch, [field]: value }
    const hex = oklchToHex(next.l, next.c, next.h)
    setSwatches((all) => all.map((s, i) => i === active ? { ...s, hex, name: colorName(hex, i) } : s))
  }
  function setSwatchCount(value: number) {
    const n = Math.max(5, Math.min(12, value)); setCount(n)
    if (n > swatches.length) setSwatches((s) => [...s, ...toSwatches(starterColors).slice(0, n - s.length)])
    else { setSwatches((s) => s.slice(0, n)); setActive((a) => Math.min(a, n - 1)); setForeground((a) => Math.min(a, n - 1)); setBackground((a) => Math.min(a, n - 1)) }
  }
  async function copyTokens() { try { await navigator.clipboard.writeText(text); setCopied(true); notify('Copied to clipboard.'); window.setTimeout(() => setCopied(false), 1800) } catch { notify('Clipboard access is unavailable in this browser.') } }
  async function copySwatch(hex: string) { try { await navigator.clipboard.writeText(hex); notify(`${hex} copied.`) } catch { notify('Clipboard access is unavailable in this browser.') } }
  async function copyShareLink() {
    const url = new URL(window.location.href)
    url.searchParams.set('palette', swatches.map((swatch) => swatch.hex.slice(1)).join(','))
    try { await navigator.clipboard.writeText(url.toString()); notify('Palette link copied — ready to share.') }
    catch { notify('Clipboard access is unavailable in this browser.') }
  }
  if (window.location.pathname === '/privacy') return <PrivacyPage />

  return <div className="app-shell">
    <nav className="navbar navbar-expand-lg topbar"><div className="container-fluid app-container px-0"><a className="navbar-brand brand-mark" href="#top"><span className="brand-icon"><i /><i /><i /><i /></span><span>paletto<span className="brand-period">.</span></span></a><div className="top-nav"><a href="#how-it-works">How it works</a><a href="#about">About</a><a href="/privacy">Privacy</a><span className="nav-divider" /><span className="local-badge"><LockKeyhole size={13} /> Private by design</span></div><button className="btn btn-dark header-button" onClick={() => fileInput.current?.click()}><ImagePlus size={16} /> New palette</button></div></nav>
    <main id="top" className="container-fluid app-container main-content">
      <div className="eyebrow"><Sparkles size={13} /> YOUR IMAGE, IN COLOUR</div>
      <div className="hero-heading-row"><div><h1>Find the feeling<br className="mobile-break" /> in every <em>colour.</em></h1><p className="intro-copy">Turn the images you love into palettes you can actually use.</p></div><div className="hero-note"><span className="note-scribble">✳</span><span>A little colour<br />goes a long way.</span></div></div>
      <section className="workspace-grid" aria-label="Palette workspace">
        <div className="left-column">
          <div className={`image-card ${dragging ? 'is-dragging' : ''} ${image ? '' : 'empty-image-card'}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]) }}>
            {image ? <><img className="source-image" src={image} alt={`Source image: ${imageLabel}`} /><div className="image-overlay" /><div className="image-topline"><span className="image-label"><i className="status-dot" /> SOURCE IMAGE</span><button className="icon-button on-image" aria-label="Choose another image" onClick={() => fileInput.current?.click()}><RotateCcw size={15} /></button></div><div className="image-caption"><span>{imageLabel}</span><span>·</span><span>{swatches.length} colours found</span></div><button className="image-hover-hint" onClick={() => fileInput.current?.click()}><ImagePlus size={15} /> Drop a new image here</button></> : <button className="empty-dropzone" onClick={() => fileInput.current?.click()}><span className="dropzone-privacy">Files never leave your browser</span><span className="dropzone-icon"><ImagePlus size={19} /></span><strong>Drop an image to find your palette</strong><span>or <u>browse your files</u> · JPG, PNG, WEBP</span></button>}
          </div>
          <div className="preset-heading"><span>START WITH A LITTLE INSPIRATION</span><span>10 IMAGES</span></div>
          <div className="preset-grid" aria-label="Choose one of ten sample images">{presetImages.map((preset, i) => <button className={`preset-card ${image === preset.src ? 'active' : ''}`} key={preset.src} onClick={() => loadPreset(preset.src, preset.title)} aria-label={`Make a palette from ${preset.title}`}><img src={preset.src} alt="" loading="lazy" /><span className="preset-number">{String(i + 1).padStart(2, '0')}</span><span className="preset-title">{preset.title}</span></button>)}</div>
          <div className="source-footer"><span><ShieldCheck size={14} /> Your images stay on your device</span><button className="text-button" onClick={() => fileInput.current?.click()}><Upload size={14} /> Upload image <kbd>⌘ O</kbd></button></div>
          <div className="palette-title-row"><div><div className="section-kicker">THE GOOD STUFF</div><h2>Your palette<span className="tiny-count">{String(swatches.length).padStart(2, '0')}</span></h2></div><div className="swatch-count"><label htmlFor="swatch-count">SWATCHES</label><div className="select-shell"><select id="swatch-count" value={count} onChange={(e) => setSwatchCount(+e.target.value)}>{Array.from({ length: 8 }, (_, i) => i + 5).map((n) => <option key={n} value={n}>{n} colours</option>)}</select><ChevronDown size={12} /></div></div></div>
          <div className="palette-strip" role="list" aria-label="Extracted color palette">{swatches.map((s, i) => <button key={`${i}-${s.hex}`} role="listitem" className={`swatch ${active === i ? 'selected' : ''}`} onClick={() => { setActive(i); void copySwatch(s.hex) }} aria-label={`Copy ${s.hex} and edit`} title="Click to copy HEX and edit this colour"><span className="swatch-color" style={{ backgroundColor: s.hex }}><span className="swatch-check">{active === i && <Check size={13} />}</span></span><span className="swatch-name">{s.name}</span><span className="swatch-hex">{s.hex}</span></button>)}</div>
          <div className="palette-actions"><button className="btn btn-dark save-button" onClick={savePalette} disabled={!image && imageLabel !== 'Shared palette'}><Check size={15} /> Save palette</button><button className="subtle-action" onClick={regenerate} disabled={!image}><Sparkles size={14} /> Generate again</button><span className="saved-inline"><Clock3 size={13} /> Saved locally</span></div>
        </div>
        <div className="right-column">
          <section className="tool-card editor-card"><div className="card-head"><div><span className="step-number">01</span><div><div className="section-kicker">MAKE IT YOURS</div><h3>Colour editor</h3></div></div><SlidersHorizontal size={16} className="muted-icon" /></div>
            <div className="editor-color-row"><span className="editor-chip" style={{ background: selected.hex }} /><div className="editor-color-text"><span>{selected.name}</span><small>SWATCH {String(active + 1).padStart(2, '0')}</small></div><label className="hex-edit"><input aria-label="Edit hex colour" value={selected.hex} maxLength={7} onChange={(e) => { const v = e.target.value.toUpperCase(); if (/^#[0-9A-F]{6}$/.test(v)) setSwatches((all) => all.map((s, i) => i === active ? { ...s, hex: v, name: colorName(v, i) } : s)) }} /><span>HEX</span></label></div>
            <div className="range-control"><div><label>HUE</label><span>{oklch.h}°</span></div><input aria-label="Hue" className="hue-range" type="range" min="0" max="360" value={oklch.h} onChange={(e) => adjust('h', +e.target.value)} /></div><div className="range-control"><div><label>CHROMA</label><span>{oklch.c}%</span></div><input aria-label="Chroma" className="sat-range" type="range" min="0" max="40" value={oklch.c} onChange={(e) => adjust('c', +e.target.value)} /></div><div className="range-control"><div><label>LIGHTNESS</label><span>{oklch.l}%</span></div><input aria-label="Lightness" className="light-range" type="range" min="0" max="100" value={oklch.l} onChange={(e) => adjust('l', +e.target.value)} /></div><p className="editor-footnote"><Pipette size={13} /> Fine-tune in perceptual OKLCH colour space.</p>
          </section>
          <section className="tool-card contrast-card"><div className="card-head"><div><span className="step-number">02</span><div><div className="section-kicker">READABLE BY DESIGN</div><h3>Contrast check</h3></div></div><CircleHelp size={16} className="muted-icon" /></div>
            <div className="pair-selectors"><div className="pair-picker"><label>TEXT</label><div className="picker-wrap"><i style={{ background: swatches[foreground]?.hex }} /><select aria-label="Text colour" value={foreground} onChange={(e) => setForeground(+e.target.value)}>{swatches.map((s, i) => <option key={i} value={i}>{s.hex}</option>)}</select><ChevronDown size={12} /></div></div><span className="pair-on">on</span><div className="pair-picker"><label>BACKGROUND</label><div className="picker-wrap"><i style={{ background: swatches[background]?.hex }} /><select aria-label="Background colour" value={background} onChange={(e) => setBackground(+e.target.value)}>{swatches.map((s, i) => <option key={i} value={i}>{s.hex}</option>)}</select><ChevronDown size={12} /></div></div></div>
            <div className="contrast-preview" style={{ color: swatches[foreground]?.hex, background: swatches[background]?.hex }}><span>Aa</span><small>Sample text preview</small></div><div className="contrast-result"><div><i className={`pass-dot ${ratio >= 4.5 ? '' : 'fail'}`} /><strong>{ratio.toFixed(2)}:1</strong><span className={`contrast-status ${ratio >= 4.5 ? 'pass' : 'fail-text'}`}>{ratio >= 4.5 ? 'Looks good' : 'Needs a boost'}</span></div><div className="wcag-pills"><span className={ratio >= 4.5 ? 'wcag-pass' : ''}>AA</span><span className={ratio >= 7 ? 'wcag-pass' : ''}>AAA</span></div></div><p className="wcag-note">WCAG 2.2 · Normal text needs 4.5:1 for AA.</p>
          </section>
          <section className="tool-card export-card"><div className="card-head export-head"><div><span className="step-number">03</span><div><div className="section-kicker">READY WHEN YOU ARE</div><h3>Take it with you</h3></div></div><ArrowDownToLine size={16} className="muted-icon" /></div><div className="export-tabs" role="tablist">{(['CSS', 'Tailwind', 'SCSS'] as ExportFormat[]).map((item) => <button key={item} className={format === item ? 'active' : ''} role="tab" aria-selected={format === item} onClick={() => setFormat(item)}>{item}</button>)}</div><pre className="code-box"><code>{text}</code></pre><button className="btn copy-button" onClick={copyTokens}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied!' : 'Copy tokens'}</button><button className="btn share-button" onClick={copyShareLink} disabled={!image && imageLabel !== 'Shared palette'}><Share2 size={14} />Copy share link</button><p className="share-note">Shares palette colours only; photos stay in your browser.</p></section>
        </div>
      </section>
      <section className="steps-section" id="how-it-works"><div className="steps-intro"><div className="section-kicker">THREE STEPS. ZERO FUSS.</div><h2>From image to<br /><em>inspiration.</em></h2></div><div className="step-item"><span>01</span><strong>Bring a photo</strong><p>Choose an image or simply drop it into the frame.</p></div><div className="step-item"><span>02</span><strong>Find your colours</strong><p>Fine-tune the palette and make every pairing accessible.</p></div><div className="step-item"><span>03</span><strong>Make it yours</strong><p>Save it for later or take the tokens into your code.</p></div></section>
      <section className="history-section"><div className="history-heading"><div><div className="section-kicker">A PERSONAL LITTLE LIBRARY</div><h2>Palette history</h2></div><span className="history-count">{saved.length ? `${String(saved.length).padStart(2, '0')} SAVED` : 'JUST FOR YOU'}</span></div>{saved.length ? <div className="history-grid">{saved.map((item) => <div className="history-card" key={item.id}><button className="history-open" onClick={() => { setImage(item.image); setImageLabel(item.title); setSwatches(item.colors); setCount(item.colors.length); setActive(0); notify('Palette restored.') }} aria-label={`Restore ${item.title}`}><span className="history-swatches">{item.colors.map((s, i) => <i key={i} style={{ background: s.hex }} />)}</span><span className="history-meta"><strong>{item.title}</strong><small>{item.date} · {item.colors.length} colours</small></span></button><button className="history-delete" aria-label="Delete saved palette" onClick={() => setSaved((items) => items.filter((p) => p.id !== item.id))}><Trash2 size={14} /></button></div>)}</div> : <div className="history-empty"><div className="empty-icon"><Clock3 size={17} /></div><div><strong>Your next favourite palette lives here.</strong><p>Save a palette to keep it close. Everything stays in this browser.</p></div><button onClick={savePalette}>Save this palette <ArrowRight size={14} /></button></div>}</section>
      <section className="about-section" id="about"><div className="about-flower">✳</div><div><div className="section-kicker">A NOTE FROM US</div><h2>Made for the colour-curious.</h2><p>Paletto is a small, thoughtful tool for the moments when a photo just feels like a palette. Your images are processed right here in your browser — never uploaded, never stored on a server.</p><a href="https://acetix.xyz/about" target="_blank" rel="noreferrer">A little more about us <ArrowRight size={14} /></a></div><div className="about-side-note">GOOD COLOUR.<br />GOOD CONTRAST.<br />GOOD TO GO.</div></section>
    </main>
    <footer className="site-footer"><div className="container-fluid app-container footer-inner"><a className="footer-brand" href="#top"><span className="brand-icon"><i /><i /><i /><i /></span>paletto<span className="brand-period">.</span></a><span className="footer-made">A tiny tool for seeing colour differently <b>✳</b></span><div className="footer-links"><a href="https://acetix.xyz/privacy" target="_blank" rel="noreferrer">Privacy</a><a href="https://acetix.xyz/about" target="_blank" rel="noreferrer">About</a><a href="mailto:acetix.team@gmail.com">Say hello <ArrowRight size={12} /></a></div><span className="copyright">© 2026 acetix</span></div></footer>
    <input ref={fileInput} className="visually-hidden" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { loadFile(e.target.files?.[0]); e.target.value = '' }} />{toast && <div className="toast-note" role="status"><Check size={15} />{toast}<button aria-label="Dismiss" onClick={() => setToast('')}><X size={13} /></button></div>}
  </div>
}

function PrivacyPage() {
  return <div className="privacy-page"><nav className="navbar topbar"><div className="container-fluid app-container px-0"><a className="navbar-brand brand-mark" href="/"><span className="brand-icon"><i /><i /><i /><i /></span><span>paletto<span className="brand-period">.</span></span></a><a className="back-link" href="/">← Back to Paletto</a></div></nav><main className="privacy-content"><div className="eyebrow"><ShieldCheck size={13} /> YOUR PRIVACY MATTERS</div><h1>Privacy, in plain language.</h1><p className="privacy-updated">Last updated September 23, 2026</p><p>Paletto is a free colour palette tool by acetix. We designed it to work without an account and to keep your images on your device.</p><h2>Your images &amp; palettes</h2><p>Images you choose are read and processed locally in your browser to extract colours. Paletto does not upload your images to a server. Palettes you save are stored in your browser's local storage and remain on this device. Clearing browser data will remove them.</p><h2>Information we collect</h2><p>Paletto does not ask for personal information, create user accounts, or use advertising cookies. The hosting provider may process standard technical request data to deliver this website. We do not sell personal data.</p><h2>Advertising</h2><p>Paletto currently does not display advertising. If advertising is introduced in the future, we will update this notice and provide appropriate disclosures and controls in line with applicable policies and law.</p><h2>External links</h2><p>Links to acetix.xyz and your email app are governed by the privacy practices of those services. For acetix's broader policies, visit <a href="https://acetix.xyz/privacy" target="_blank" rel="noreferrer">acetix.xyz/privacy</a>.</p><h2>Contact</h2><p>Questions about this notice? Write to <a href="mailto:acetix.team@gmail.com">acetix.team@gmail.com</a>.</p><a className="btn btn-dark privacy-home" href="/">Back to your palette <ArrowRight size={15} /></a></main><footer className="site-footer"><div className="container-fluid app-container footer-inner"><span className="copyright">© 2026 acetix · Paletto</span><div className="footer-links"><a href="https://acetix.xyz/privacy" target="_blank" rel="noreferrer">acetix privacy</a><a href="mailto:acetix.team@gmail.com">Contact</a></div></div></footer></div>
}
