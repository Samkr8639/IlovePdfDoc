import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { Router } from '@angular/router';
import { ToolRegistryService } from '../../../core/services/tool-registry.service';

export interface UploadProgressItem {
  name: string;
  size: string;
  progress: number;
  isComplete: boolean;
}

interface TrailDot {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

interface Layout {
  w: number;
  h: number;
  homeX: number;
  homeY: number;
  rimX: number;
  cardL: number;
  cardR: number;
  cardB: number;
  /** pull-distance -> launch-speed multiplier (1/s), calibrated per layout */
  k: number;
  /** pull angle (deg from straight down, towards the left) of the canonical shot */
  autoAngle: number;
}

interface Flight {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  sx: number;
  fade: number;
  rimHits: number;
  scored: boolean;
  inCard: boolean;
  last: number;
}

interface Job {
  name: string;
  size: string;
  count: number;
  files?: File[];
}

type Phase = 'idle' | 'dragging' | 'busy';

/* ---------- Stage geometry (design px, matches the CSS) ---------- */
const STAGE_H = 580;
const CARD_W = 402;
const RIM_Y = 272; // rim centre line == bottom edge of the drop card
const NET_H = 100;
const BALL_W = 72;
const BALL_H = 90;
const HOME_Y = 400;

/* ---------- Physics / game feel ---------- */
const GRAVITY = 1100; // px/s^2  -> ~1.2s floaty flight like the video
const MAX_PULL = 150; // px
const MIN_PULL = 18; // px, smaller than this counts as a click
const AUTO_PULL = 100; // px, pull length of the canonical / auto shot
const AUTO_CLEARANCE = 110; // px the canonical arc peaks above the rim
const ASSIST = 80; // px: shots crossing the rim this close to centre are steered in
const MADE_R = 46; // px: unassisted "swish" radius
const RIM_R = 118; // px: hits between MADE_R and this bounce off the rim
const SPIN = 105; // deg/s tumble in the air
const TRAIL_DOTS = 16;
const TRAIL_STEP = 0.075; // s between preview dots

const DEFAULT_NAME = 'final fileeeeee';
const DEFAULT_JOB: Job = { name: DEFAULT_NAME, size: '2.4 MB', count: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Mesh lines for the net SVG (viewBox 0 0 164 104). */
function buildNetPaths(): { ribs: string; weave: string; rings: string } {
  const topY = 3;
  const botY = 100;
  const n = 6;
  const topX = (i: number) => 10 + i * (144 / n);
  const botX = (i: number) => 34 + i * (96 / n);
  const f = (v: number) => v.toFixed(1);
  let ribs = '';
  let weave = '';
  let rings = '';
  for (let i = 0; i <= n; i++) {
    ribs += `M${f(topX(i))} ${topY}L${f(botX(i))} ${botY}`;
  }
  for (let i = 0; i < n; i++) {
    weave += `M${f(topX(i))} ${topY}L${f(botX(i + 1))} ${botY}`;
    weave += `M${f(topX(i + 1))} ${topY}L${f(botX(i))} ${botY}`;
  }
  for (const t of [0.34, 0.67]) {
    const y = topY + t * (botY - topY);
    const x0 = topX(0) + (botX(0) - topX(0)) * t;
    const x1 = topX(n) + (botX(n) - topX(n)) * t;
    rings += `M${f(x0)} ${f(y)}L${f(x1)} ${f(y)}`;
  }
  return { ribs, weave, rings };
}

@Component({
  selector: 'app-dropzone',
  standalone: true,
  templateUrl: './dropzone.component.html',
  styleUrl: './dropzone.component.css'
})
export class DropzoneComponent {
  private readonly router = inject(Router, { optional: true });
  private readonly toolRegistry = inject(ToolRegistryService, { optional: true });
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stageEl = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly ballEl = viewChild.required<ElementRef<HTMLElement>>('ball');
  private readonly fileInputEl = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  /** Heading above the drop zone. */
  readonly title = input<string>('Upload files');
  readonly subtitle = input<string>('');
  /** Label of the primary "select file" button. */
  readonly buttonLabel = input<string>('Select PDF file');
  readonly acceptedTypes = input<string>('.pdf,application/pdf');
  readonly multiple = input<boolean>(true);
  readonly limitInfo = input<string>('Max 5 files, 800MB each');
  readonly ariaLabel = input<string>('Upload documents dropzone');
  readonly toolName = input<string>('');
  readonly toolDescription = input<string>('');

  readonly filesSelected = output<File[]>();

  /* ---------- template state ---------- */
  readonly isDragOver = signal<boolean>(false);
  readonly cardHot = signal<boolean>(false);
  readonly scoreBump = signal<boolean>(false);
  readonly plusVisible = signal<boolean>(false);
  readonly netSwish = signal<boolean>(false);
  readonly rimHit = signal<boolean>(false);
  readonly uploadedCount = signal<number>(0);
  readonly activeUpload = signal<UploadProgressItem | null>(null);
  readonly trail = signal<TrailDot[]>([]);
  readonly phase = signal<Phase>('idle');
  readonly ballLabel = signal<string>(DEFAULT_NAME);
  readonly hasBall = signal<boolean>(false);

  readonly fileBadge = computed(() => {
    const file = this.job?.files?.[0];
    const name = file ? file.name : this.ballLabel();
    if (!name || name === DEFAULT_NAME) return 'PDF';
    const cleanName = name.split(' ')[0];
    const lastDot = cleanName.lastIndexOf('.');
    if (lastDot !== -1 && lastDot < cleanName.length - 1) {
      const ext = cleanName.slice(lastDot + 1).trim().toUpperCase();
      return ext.length <= 4 ? ext : ext.slice(0, 4);
    }
    return 'PDF';
  });

  readonly net = buildNetPaths();

  readonly liveMessage = computed(() => {
    const n = this.uploadedCount();
    return n === 0 ? '' : `Uploaded ${n} ${n === 1 ? 'file' : 'files'}`;
  });

  readonly currentRoute = computed(() => {
    return this.router?.url?.split('?')[0] || '/';
  });

  readonly effectiveToolName = computed(() => {
    if (this.toolName()) {
      return this.toolName();
    }
    const route = this.currentRoute().replace(/^\//, '');
    return route ? route.replace(/-/g, '_') : 'pdf_tool';
  });

  readonly effectiveToolDescription = computed(() => {
    if (this.toolDescription()) {
      return this.toolDescription();
    }
    const tool = this.toolRegistry?.getToolByRoute(this.currentRoute());
    return tool?.shortDescription || this.title() || 'Upload and process documents';
  });

  /* ---------- internal (non-reactive) game state ---------- */
  private layout!: Layout;
  private reduceMotion = false;
  private job: Job = DEFAULT_JOB;
  private flight: Flight | null = null;
  private raf = 0;
  private tweenRaf = 0;
  private readonly timers = new Set<number>();

  private bx = 0;
  private by = HOME_Y;
  private brot = 0;
  private grabDX = 0;
  private grabDY = 0;
  private activePointer = -1;

  constructor() {
    afterNextRender(() => {
      this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      this.layout = this.measure();
      this.setBall(this.layout.homeX, this.layout.homeY, 0, 1, 1, 0);

      let ro: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          this.layout = this.measure();
          if (this.phase() === 'idle' && this.hasBall()) {
            this.setBall(this.layout.homeX, this.layout.homeY);
          }
        });
        ro.observe(this.stageEl().nativeElement);
      }

      this.destroyRef.onDestroy(() => {
        ro?.disconnect();
        this.cleanup();
      });
    });
  }

  /* =====================================================================
   * Real file input (drag from desktop / picker). Same API as before.
   * ===================================================================== */

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const files = Array.from(event.dataTransfer.files);
      const toEmit = this.multiple() ? files : [files[0]];
      this.prepareFileForLaunch(toEmit);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      const toEmit = this.multiple() ? files : [files[0]];
      input.value = '';
      this.prepareFileForLaunch(toEmit);
    }
  }

  /**
   * Prepares the user's selected file(s) for launch:
   * displays the file at the launch position with a spring pop-in animation,
   * showing its actual name and badge. The user can then slingshot or click to launch it.
   */
  private prepareFileForLaunch(files: File[]): void {
    const total = files.reduce((sum, f) => sum + f.size, 0);
    const first = files[0].name;
    const job: Job = {
      name: files.length > 1 ? `${first} +${files.length - 1}` : first,
      size: this.formatFileSize(total),
      count: files.length,
      files
    };

    this.job = job;
    this.ballLabel.set(job.name);
    this.hasBall.set(true);
    this.activeUpload.set(null);

    this.layout = this.measure();
    const L = this.layout;
    this.ballEl().nativeElement.classList.remove('in-hoop');

    if (this.reduceMotion) {
      this.setBall(L.homeX, L.homeY, 0, 1, 1, 1);
      this.phase.set('idle');
      return;
    }

    this.setBall(L.homeX, L.homeY, 0, 0.4, 0.4, 0);
    this.phase.set('busy');
    this.animate(
      420,
      (t) => {
        const s = 0.4 + 0.6 * easeOutBack(t);
        this.setBall(L.homeX, L.homeY, 0, s, s, Math.min(1, t * 2.5));
      },
      () => {
        this.setBall(L.homeX, L.homeY, 0, 1, 1, 1);
        this.phase.set('idle');
      }
    );
  }

  private formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    }
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }

  openGoogleDrive(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    window.open('https://drive.google.com/', '_blank', 'noopener,noreferrer');
  }

  openDropbox(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    window.open('https://www.dropbox.com/home', '_blank', 'noopener,noreferrer');
  }

  /* =====================================================================
   * Playable file: grab -> pull back -> aim with dotted arc -> release
   * ===================================================================== */

  onHoopCardClick(): void {
    if (this.phase() !== 'idle') return;
    if (this.hasBall()) {
      this.takeShot();
    } else {
      this.fileInputEl()?.nativeElement.click();
    }
  }

  onBallPointerDown(e: PointerEvent): void {
    if (!this.hasBall() || this.phase() !== 'idle' || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();

    this.layout = this.measure();
    try {
      this.ballEl().nativeElement.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    const p = this.toStage(e);
    this.grabDX = p.x - this.bx;
    this.grabDY = p.y - this.by;
    this.activePointer = e.pointerId;
    this.activeUpload.set(null);
    this.phase.set('dragging');
  }

  onBallPointerMove(e: PointerEvent): void {
    if (this.phase() !== 'dragging' || e.pointerId !== this.activePointer) return;
    const L = this.layout;
    const p = this.toStage(e);

    let dx = p.x - this.grabDX - L.homeX;
    let dy = p.y - this.grabDY - L.homeY;
    const len = Math.hypot(dx, dy);
    if (len > MAX_PULL) {
      dx *= MAX_PULL / len;
      dy *= MAX_PULL / len;
    }
    const x = clamp(L.homeX + dx, 40, L.w - 40);
    const y = clamp(L.homeY + dy, 60, L.h - 34);

    this.setBall(x, y, ((x - L.homeX) / MAX_PULL) * 16);
    this.updateAim(x, y);
  }

  onBallPointerUp(e: PointerEvent): void {
    if (this.phase() !== 'dragging' || e.pointerId !== this.activePointer) return;
    this.releaseCapture(e);

    const L = this.layout;
    const px = L.homeX - this.bx;
    const py = L.homeY - this.by;
    this.setTrail([]);

    // A plain click (no pull) shoots the file into the net automatically.
    if (Math.hypot(px, py) < MIN_PULL) {
      this.phase.set('idle');
      this.startAutoShot(this.job);
      return;
    }
    this.phase.set('busy');
    this.launch(this.bx, this.by, px * L.k, py * L.k);
  }

  onBallPointerCancel(e: PointerEvent): void {
    if (this.phase() !== 'dragging' || e.pointerId !== this.activePointer) return;
    this.releaseCapture(e);
    this.setTrail([]);
    this.phase.set('busy');
    this.snapHome();
  }

  onBallKey(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.hasBall()) {
      this.takeShot();
    }
  }

  /** Launch the file into the hoop or open file picker if no file selected yet. */
  takeShot(event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    if (this.phase() !== 'idle' || !this.layout) return;
    if (this.hasBall()) {
      this.startAutoShot(this.job);
    } else {
      this.fileInputEl()?.nativeElement.click();
    }
  }

  /* ---------- aiming ---------- */

  private updateAim(x: number, y: number): void {
    const L = this.layout;
    const px = L.homeX - x;
    const py = L.homeY - y;
    if (Math.hypot(px, py) < MIN_PULL) {
      this.setTrail([]);
      return;
    }
    const vy = py * L.k;
    const vx = this.resolveShot(x, y, px * L.k, vy).vx;
    const dots: TrailDot[] = [];
    for (let i = 1; i <= TRAIL_DOTS; i++) {
      const t = i * TRAIL_STEP;
      const f = (i - 1) / (TRAIL_DOTS - 1);
      dots.push({
        x: x + vx * t,
        y: y + vy * t + 0.5 * GRAVITY * t * t,
        size: 6.2 - 3.6 * f,
        opacity: 0.95 - 0.78 * f
      });
    }
    this.setTrail(dots);
  }

  /**
   * Magnet assist: a shot that would cross the rim line within ASSIST px of the
   * centre gets its horizontal speed nudged so it drops dead centre. The aim
   * preview uses the same function, so the dotted arc shows what will happen.
   */
  private resolveShot(x0: number, y0: number, vx: number, vy: number): { vx: number; made: boolean } {
    const tc = this.crossTime(y0, vy);
    if (tc !== null && Math.abs(x0 + vx * tc - this.layout.rimX) <= ASSIST) {
      return { vx: (this.layout.rimX - x0) / tc, made: true };
    }
    return { vx, made: false };
  }

  /** Larger root of y(t) = RIM_Y: the moment a shot comes back down through the rim line. */
  private crossTime(y0: number, vy: number): number | null {
    const a = 0.5 * GRAVITY;
    const c = y0 - RIM_Y;
    const disc = vy * vy - 4 * a * c;
    if (disc < 0) return null;
    const t = (-vy + Math.sqrt(disc)) / (2 * a);
    return t > 0 ? t : null;
  }

  /* ---------- scripted perfect shot ---------- */

  private startAutoShot(job: Job): void {
    this.job = job;
    this.ballLabel.set(job.name);
    this.hasBall.set(true);
    this.layout = this.measure();
    this.activeUpload.set(null);
    this.phase.set('busy');

    const L = this.layout;
    if (this.reduceMotion) {
      this.hideBall();
      this.runScoreTimeline();
      return;
    }

    const rad = (L.autoAngle * Math.PI) / 180;
    const tx = L.homeX - AUTO_PULL * Math.sin(rad);
    const ty = L.homeY + AUTO_PULL * Math.cos(rad);

    // pull back (like the user's hand does), show the arc, then let go
    this.animate(
      420,
      (t) => {
        const e = easeOutCubic(t);
        const x = lerp(L.homeX, tx, e);
        const y = lerp(L.homeY, ty, e);
        this.setBall(x, y, ((x - L.homeX) / MAX_PULL) * 16, 1, 1, 1);
        this.updateAim(x, y);
      },
      () => {
        this.later(150, () => {
          this.setTrail([]);
          this.launch(tx, ty, (L.homeX - tx) * L.k, (L.homeY - ty) * L.k);
        });
      }
    );
  }

  /* =====================================================================
   * Flight
   * ===================================================================== */

  private launch(x0: number, y0: number, vx: number, vy: number): void {
    this.phase.set('busy');

    const resolved = this.resolveShot(x0, y0, vx, vy);
    vx = resolved.vx;
    const made = resolved.made;

    if (this.reduceMotion) {
      if (made) {
        this.hideBall();
        this.runScoreTimeline();
      } else {
        this.respawnBall(150);
      }
      return;
    }

    this.flight = {
      x: x0,
      y: y0,
      vx,
      vy,
      rot: this.brot,
      spin: SPIN,
      sx: 1,
      fade: 0,
      rimHits: 0,
      scored: false,
      inCard: false,
      last: performance.now()
    };
    this.ballEl().nativeElement.classList.remove('in-hoop');
    this.zone.runOutsideAngular(() => {
      this.raf = requestAnimationFrame(this.step);
    });
  }

  private step = (now: number): void => {
    const f = this.flight;
    if (!f) return;
    const L = this.layout;
    const dt = clamp((now - f.last) / 1000, 0.001, 0.032);
    f.last = now;

    const prevY = f.y;
    f.x += f.vx * dt;
    f.y += f.vy * dt + 0.5 * GRAVITY * dt * dt;
    f.vy += GRAVITY * dt;
    f.rot += f.spin * dt;

    let opacity = 1;

    if (!f.scored) {
      // coming down through the rim line?
      if (f.vy > 0 && prevY < RIM_Y && f.y >= RIM_Y) {
        const dx = f.x - L.rimX;
        if (Math.abs(dx) <= MADE_R) {
          this.onScore(f);
        } else if (Math.abs(dx) <= RIM_R && f.rimHits < 3) {
          // clanks off the rim
          f.rimHits++;
          f.y = RIM_Y - 2;
          f.vy = -Math.abs(f.vy) * 0.45;
          f.vx = f.vx * 0.4 + Math.sign(dx || 1) * 170;
          f.spin += Math.sign(dx || 1) * 140;
          this.run(() => {
            this.rimHit.set(true);
            this.later(260, () => this.rimHit.set(false));
          });
        }
      }

      if (!f.scored) {
        // card lights up while the file is over it (like the video)
        const over = f.x >= L.cardL && f.x <= L.cardR && f.y <= L.cardB + 10;
        if (over !== f.inCard) {
          f.inCard = over;
          this.run(() => this.cardHot.set(over));
        }
        if (f.y > L.h + 110 || f.x < -120 || f.x > L.w + 120) {
          this.endMiss();
          return;
        }
      }
    }

    if (f.scored) {
      f.vx *= Math.exp(-7 * dt);
      f.spin *= Math.exp(-3 * dt);
      if (f.y < RIM_Y + NET_H + 6) {
        // dragging through the mesh: slow down and squeeze
        f.vy *= Math.exp(-5 * dt);
        f.sx += (0.8 - f.sx) * Math.min(1, dt * 14);
      } else {
        f.fade += dt / 0.26;
        f.sx += (1 - f.sx) * Math.min(1, dt * 10);
        opacity = Math.max(0, 1 - f.fade);
        if (opacity <= 0) {
          this.flight = null;
          this.hideBall();
          return;
        }
      }
    }

    this.setBall(f.x, f.y, f.rot, f.sx, 1, opacity);
    this.raf = requestAnimationFrame(this.step);
  };

  private onScore(f: Flight): void {
    f.scored = true;
    this.ballEl().nativeElement.classList.add('in-hoop');
    this.run(() => {
      this.netSwish.set(true);
      this.later(520, () => this.netSwish.set(false));
    });
    this.runScoreTimeline();
  }

  private endMiss(): void {
    this.flight = null;
    this.run(() => {
      this.cardHot.set(false);
    });
    if (this.hasBall()) {
      this.respawnBall(250);
    } else {
      this.phase.set('idle');
    }
  }

  /**
   * Everything after the file drops through the net, timed from the video:
   *  +120ms  "+1" pops beside the backboard
   *  +260ms  counter pill increments
   *  +300ms  card tint fades out
   *  +520ms  progress card slides in, bar fills, turns green, check pops
   */
  private runScoreTimeline(): void {
    const job = this.job;

    this.later(120, () => {
      this.plusVisible.set(true);
      this.later(850, () => this.plusVisible.set(false));
    });

    this.later(260, () => {
      this.uploadedCount.update((c) => c + job.count);
      this.scoreBump.set(true);
      this.later(320, () => this.scoreBump.set(false));
    });

    this.later(300, () => this.cardHot.set(false));

    this.later(520, () => {
      this.activeUpload.set({ name: job.name, size: job.size, progress: 0, isComplete: false });
      this.later(40, () => this.activeUpload.update((u) => (u ? { ...u, progress: 100 } : u)));
      this.later(780, () => {
        this.activeUpload.update((u) => (u ? { ...u, isComplete: true } : u));
        this.hasBall.set(false);
        this.hideBall();
        if (job.files) {
          this.filesSelected.emit(job.files);
        }
        this.phase.set('idle');
      });
    });
  }

  /* =====================================================================
   * Returning / respawning the file
   * ===================================================================== */

  private snapHome(): void {
    const L = this.layout;
    const x0 = this.bx;
    const y0 = this.by;
    const r0 = this.brot;
    this.animate(
      240,
      (t) => {
        const e = easeOutCubic(t);
        this.setBall(lerp(x0, L.homeX, e), lerp(y0, L.homeY, e), lerp(r0, 0, e), 1, 1, 1);
      },
      () => this.phase.set('idle')
    );
  }

  private respawnBall(delay: number): void {
    this.later(delay, () => {
      if (!this.hasBall()) {
        this.phase.set('idle');
        return;
      }
      this.layout = this.measure();
      const L = this.layout;
      this.ballEl().nativeElement.classList.remove('in-hoop');
      this.setBall(L.homeX, L.homeY, 0, 0.6, 0.6, 0);
      this.animate(
        380,
        (t) => {
          const s = 0.6 + 0.4 * easeOutBack(t);
          this.setBall(L.homeX, L.homeY, 0, s, s, Math.min(1, t * 2.2));
        },
        () => {
          this.setBall(L.homeX, L.homeY, 0, 1, 1, 1);
          this.phase.set('idle');
        }
      );
    });
  }

  private hideBall(): void {
    this.setBall(this.bx, this.by, this.brot, 1, 1, 0);
  }

  /* =====================================================================
   * Helpers
   * ===================================================================== */

  private measure(): Layout {
    const w = this.stageEl().nativeElement.clientWidth || 680;
    const cardW = Math.min(CARD_W, w);
    const homeX = clamp(w * 0.2, 84, 150);
    const rimX = w / 2;
    const { k, angle } = this.calibrate(homeX, rimX);
    return {
      w,
      h: STAGE_H,
      homeX,
      homeY: HOME_Y,
      rimX,
      cardL: (w - cardW) / 2,
      cardR: (w + cardW) / 2,
      cardB: RIM_Y,
      k,
      autoAngle: angle
    };
  }

  /**
   * Finds the launch-speed multiplier and pull angle for which a pull of
   * AUTO_PULL px drops the file through the middle of the rim on a high lob.
   * Done at runtime so the game works on any stage width (phones included).
   */
  private calibrate(homeX: number, rimX: number): { k: number; angle: number } {
    let best = { cost: Infinity, k: 8.8, angle: 12 };
    for (let a = 4; a <= 45; a += 0.5) {
      const r = (a * Math.PI) / 180;
      const px = homeX - AUTO_PULL * Math.sin(r);
      const py = HOME_Y + AUTO_PULL * Math.cos(r);
      if (px < 44) continue;
      for (let k = 4; k <= 18; k += 0.02) {
        const vx = (homeX - px) * k;
        const vy = (HOME_Y - py) * k;
        const tc = this.crossTime(py, vy);
        if (tc === null) continue;
        const err = Math.abs(px + vx * tc - rimX);
        const apex = py - (vy * vy) / (2 * GRAVITY);
        const cost = err * 3 + Math.abs(RIM_Y - apex - AUTO_CLEARANCE);
        if (cost < best.cost) best = { cost, k, angle: a };
      }
    }
    return { k: best.k, angle: best.angle };
  }

  private toStage(e: PointerEvent): { x: number; y: number } {
    const r = this.stageEl().nativeElement.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private releaseCapture(e: PointerEvent): void {
    try {
      this.ballEl().nativeElement.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    this.activePointer = -1;
  }

  /** Writes straight to the DOM: 60fps without touching change detection. */
  private setBall(x: number, y: number, rot = 0, sx = 1, sy = 1, opacity = 1): void {
    this.bx = x;
    this.by = y;
    this.brot = rot;
    const el = this.ballEl().nativeElement;
    el.style.transform =
      `translate3d(${(x - BALL_W / 2).toFixed(1)}px,${(y - BALL_H / 2).toFixed(1)}px,0) ` +
      `rotate(${rot.toFixed(1)}deg) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
    el.style.opacity = String(opacity);
  }

  private setTrail(dots: TrailDot[]): void {
    this.run(() => this.trail.set(dots));
  }

  private run(fn: () => void): void {
    if (NgZone.isInAngularZone()) {
      fn();
    } else {
      this.zone.run(fn);
    }
  }

  private later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      this.run(fn);
    }, ms);
    this.timers.add(id);
  }

  private animate(ms: number, frame: (t: number) => void, done?: () => void): void {
    const start = performance.now();
    this.zone.runOutsideAngular(() => {
      const tick = (now: number) => {
        const t = clamp((now - start) / ms, 0, 1);
        frame(t);
        if (t < 1) {
          this.tweenRaf = requestAnimationFrame(tick);
        } else if (done) {
          this.run(done);
        }
      };
      this.tweenRaf = requestAnimationFrame(tick);
    });
  }

  private cleanup(): void {
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.tweenRaf);
    this.timers.forEach((id) => clearTimeout(id));
    this.timers.clear();
    this.flight = null;
  }
}