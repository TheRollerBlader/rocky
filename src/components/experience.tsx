"use client";

import { useEffect, useRef, useState } from "react";
import { EXPLODE_GROUPS, smoothstep } from "@/lib/rocket";
import type { CalloutFrame } from "@/components/rocket-scene";

const LABELS = EXPLODE_GROUPS.filter((group) => group.label);

function chapterOpacity(progress: number, fadeIn: [number, number], fadeOut: [number, number]) {
  return smoothstep(fadeIn[0], fadeIn[1], progress) * (1 - smoothstep(fadeOut[0], fadeOut[1], progress));
}

export function Experience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const explodedRef = useRef<HTMLElement>(null);
  const calloutRefs = useRef(new Map<string, HTMLDivElement>());
  const sceneRef = useRef<{ selectPart: (id: string, fromUser?: boolean) => void } | null>(null);

  const [ready, setReady] = useState(false);
  const [activePartId, setActivePartId] = useState<string>("nose");

  const activeGroup = EXPLODE_GROUPS.find((g) => g.id === activePartId) || EXPLODE_GROUPS[0];

  const handleSelectPart = (partId: string) => {
    setActivePartId(partId);
    sceneRef.current?.selectPart(partId, true);
  };

  useEffect(() => {
    let cancelled = false;
    let dispose = () => {};

    const paintCallouts = (frames: CalloutFrame[]) => {
      for (const frame of frames) {
        const node = calloutRefs.current.get(frame.id);
        if (!node) continue;
        node.style.transform = `translate3d(${frame.x}px, ${frame.y}px, 0)`;
        node.style.opacity = frame.opacity.toFixed(3);
        node.dataset.side = frame.side;
      }
    };

    const paintChapters = (progress: number) => {
      const heroOpacity = 1 - smoothstep(0.08, 0.18, progress);
      const explodedOpacity = chapterOpacity(progress, [0.18, 0.28], [0.9, 0.98]);

      if (heroRef.current) {
        heroRef.current.style.opacity = String(heroOpacity);
        heroRef.current.style.pointerEvents = heroOpacity > 0.1 ? "auto" : "none";
      }
      if (titleRef.current) titleRef.current.style.opacity = String(heroOpacity);

      if (explodedRef.current) {
        explodedRef.current.style.opacity = String(explodedOpacity);
        explodedRef.current.style.pointerEvents = explodedOpacity > 0.1 ? "auto" : "none";
      }

      if (veilRef.current) veilRef.current.style.opacity = "0";
      if (canvasRef.current) {
        canvasRef.current.style.opacity = "1";
        canvasRef.current.style.pointerEvents = progress > 0.92 ? "none" : "auto";
      }
    };

    (async () => {
      const [{ RocketScene }, gsapModule, scrollModule] = await Promise.all([
        import("@/components/rocket-scene"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled || !canvasRef.current || !storyRef.current) return;

      const gsap = gsapModule.default;
      const { ScrollTrigger } = scrollModule;
      gsap.registerPlugin(ScrollTrigger);

      const scene = new RocketScene(canvasRef.current, {
        onReady: () => {
          if (!cancelled) setReady(true);
        },
        onCallouts: paintCallouts,
        onActivePartChange: (partId) => {
          if (!cancelled) setActivePartId(partId);
        },
      });

      scene.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scene.start();
      sceneRef.current = scene;

      const context = gsap.context(() => {
        ScrollTrigger.create({
          trigger: storyRef.current,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => {
            scene.progress = self.progress;
            paintChapters(self.progress);
          },
        });

        ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: (self) => {
            if (barRef.current) barRef.current.style.transform = `scaleX(${self.progress})`;
          },
        });
      });

      const onResize = () => {
        scene.resize();
        ScrollTrigger.refresh();
      };
      const markPastStory = () => {
        const stats = document.getElementById("stats");
        const covered = stats ? stats.getBoundingClientRect().top < 72 : false;
        document.documentElement.classList.toggle("past-story", covered);
      };
      window.addEventListener("resize", onResize);
      window.addEventListener("scroll", markPastStory, { passive: true });
      paintChapters(0);
      markPastStory();

      dispose = () => {
        sceneRef.current = null;
        window.removeEventListener("resize", onResize);
        window.removeEventListener("scroll", markPastStory);
        document.documentElement.classList.remove("past-story");
        context.revert();
        scene.dispose();
      };

      if (cancelled) dispose();
    })();

    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  return (
    <div ref={rootRef} className="stage">
      <div ref={barRef} className="progress" />

      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className={ready ? "canvas is-ready" : "canvas"}
        aria-hidden="true"
      />

      <div ref={veilRef} className="veil" />
      <h1 ref={titleRef} className="hero-title">
        Rocky 1
      </h1>
      <div ref={storyRef} className="story" id="rocket" />

      {/* Hero Overlay (Clean Apple-style Space Minimalism) */}
      <section ref={heroRef} className="hero-apple" aria-label="Rocky 1 Introduction">
        <div className="hero-apple-inner">
          <p className="hero-badge">Rock Hill High School · American Rocketry Challenge</p>
          <p className="hero-subtitle">
            A competition rocket engineered from scratch for two eggs and an 800-foot flight window.
          </p>

          <div className="hero-cta-group">
            <a href="#exploded" className="hero-btn-primary">
              Explore Architecture ↓
            </a>
            <a href="#support" className="hero-btn-secondary">
              Support Mission →
            </a>
          </div>
        </div>

      </section>

      {/* Exploded View Interactive Chapter */}
      <section
        ref={explodedRef}
        id="exploded"
        className="exploded-chapter"
        style={{ opacity: 0, pointerEvents: "none" }}
        aria-label="Rocky 1 Exploded Architecture"
      >
        <div className="exploded-header">
          <p className="eyebrow">
            {String(EXPLODE_GROUPS.findIndex((group) => group.id === activePartId) + 1).padStart(2, "0")} /{" "}
            {String(EXPLODE_GROUPS.length).padStart(2, "0")}
          </p>
          <h2 className="exploded-title">{activeGroup.label}</h2>
          <p className="exploded-lead">Scroll to tour the assembly or click any subsystem below to inspect.</p>

          {/* Interactive Subsystem Pill Selector */}
          <div className="part-selector" role="tablist" aria-label="Rocket Subsystems">
            {EXPLODE_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={group.id === activePartId}
                className={`part-pill ${group.id === activePartId ? "is-active" : ""}`}
                onClick={() => handleSelectPart(group.id)}
              >
                {group.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active Technical Spec Card */}
        {activeGroup && (
          <aside className="part-card" aria-live="polite">
            <div className="part-card-header">
              <span className="part-category">{activeGroup.category}</span>
              <span className="part-status">
                <span className="part-status-dot" /> Subsystem {String(EXPLODE_GROUPS.findIndex((g) => g.id === activePartId) + 1).padStart(2, "0")} / {EXPLODE_GROUPS.length}
              </span>
            </div>
            <h3 className="part-name">{activeGroup.label}</h3>
            <p className="part-detail-muted">{activeGroup.detail}</p>
            <p className="part-description">{activeGroup.description}</p>

            <div className="part-specs-grid">
              {activeGroup.specs.map((spec) => (
                <div key={spec.label} className="part-spec-item">
                  <span className="part-spec-label">{spec.label}</span>
                  <span className="part-spec-value">{spec.value}</span>
                </div>
              ))}
            </div>
          </aside>
        )}
      </section>

      {/* 3D Callouts */}
      <div className="callouts" aria-hidden="true">
        {LABELS.map((group) => (
          <div
            key={group.id}
            className="callout-anchor"
            data-side={group.side}
            ref={(node) => {
              if (node) calloutRefs.current.set(group.id, node);
              else calloutRefs.current.delete(group.id);
            }}
          >
            <div className={`callout ${group.id === activePartId ? "callout-highlight" : ""}`}>
              <i className="rule" />
              <p>
                <b>{group.label}</b>
                <span>{group.detail}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
