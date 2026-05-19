"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── Phase flow: "intro" → (tap) → "login" → (valid sign in) → "success" → redirect to /home
type Phase = "intro" | "login" | "success";

// Background: poster image URLs. Change these to use your own assets or different TMDB IDs.
// Opacity is set later (e.g. opacity-[0.06]); increase for a stronger poster look.
const POSTERS = [
  "https://image.tmdb.org/t/p/w500/8UlWHLMpgZm9bx6QYh0NFoq67TZ.jpg",
  "https://image.tmdb.org/t/p/w500/q719jXXEzOoYaps6babgKnONONX.jpg",
  "https://image.tmdb.org/t/p/w500/kOVEVeg59E0wsnXmF9nrh6OmWII.jpg",
  "https://image.tmdb.org/t/p/w500/9O7gLzmreU0nGkIB6K3BsJbzvNv.jpg",
  "https://image.tmdb.org/t/p/w500/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg",
];

// Intro screen: big cycling quote. Edit this array to change copy or add/remove lines.
// Rotation interval is 3500ms below; change that in the useEffect if you want faster/slower.
const INTRO_QUOTES = [
  "Don't miss anything.",
  "Keep it to yourself.",
  "Never forget a movie again.",
  "Roll camera.",
  "Every story deserves to be remembered.",
];

// Login left side: rotating cinematic quotes. Edit for different movies or tone.
// Cycle interval is 4000ms in the narrative useEffect.
const NARRATIVE_QUOTES = [
  `"After all, tomorrow is another day." — Gone with the Wind`,
  `"To infinity and beyond." — Toy Story`,
  `"I'll be back." — The Terminator`,
  `"May the Force be with you." — Star Wars`,
];

export default function LandingPage() {
  const router = useRouter();

  // Core UI state
  const [phase, setPhase] = useState<Phase>("intro");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showToast, setShowToast] = useState(false); // validation error toast

  // Intro: which quote is shown, and whether it's visible (for fade transition)
  const [introIndex, setIntroIndex] = useState(0);
  const [introVisible, setIntroVisible] = useState(true);
  const [showTapPrompt, setShowTapPrompt] = useState(false); // "tap to begin" — appears after 4s

  // Login left side: rotating quote index and visibility
  const [narrativeIndex, setNarrativeIndex] = useState(0);
  const [narrativeVisible, setNarrativeVisible] = useState(true);

  // Transition flags: intro fade-out, login fade-in, success redirect
  const [introFadingOut, setIntroFadingOut] = useState(false);
  const [loginStarted, setLoginStarted] = useState(false);
  const [loginExiting, setLoginExiting] = useState(false);
  const [showRedirecting, setShowRedirecting] = useState(false);

  // Refs for timers so we can clear them on unmount and avoid leaks
  const introTimersRef = useRef<number[]>([]);
  const loginTimersRef = useRef<number[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const redirectTimerRef = useRef<number | null>(null);
  const pushTimerRef = useRef<number | null>(null);

  const clearTimers = (ref: React.MutableRefObject<number[]>) => {
    ref.current.forEach((t) => window.clearTimeout(t));
    ref.current = [];
  };

  useEffect(() => {
    return () => {
      clearTimers(introTimersRef);
      clearTimers(loginTimersRef);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
      if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);
    };
  }, []);

  // Intro quote cycling: change 3500 to adjust how often the quote changes (ms).
  useEffect(() => {
    if (phase !== "intro") return;

    const interval = setInterval(() => {
      setIntroVisible(false);

      const timeout = setTimeout(() => {
        setIntroIndex((prev) => (prev + 1) % INTRO_QUOTES.length);
        setIntroVisible(true);
      }, 700); // 0.5s fade + 0.2s pause before next quote

      return () => clearTimeout(timeout);
    }, 3500);

    return () => clearInterval(interval);
  }, [phase]);

  // "tap to begin" prompt: change 4000 to show the prompt sooner/later (ms).
  useEffect(() => {
    if (phase !== "intro") return;
    setShowTapPrompt(false);
    const t = window.setTimeout(() => setShowTapPrompt(true), 4000);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Login left-side narrative quotes: change 4000 to adjust cycle speed (ms).
  useEffect(() => {
    if (phase !== "login") return;

    const interval = setInterval(() => {
      setNarrativeVisible(false);
      const timeout = setTimeout(() => {
        setNarrativeIndex((prev) => (prev + 1) % NARRATIVE_QUOTES.length);
        setNarrativeVisible(true);
      }, 600);
      return () => clearTimeout(timeout);
    }, 4000);

    return () => clearInterval(interval);
  }, [phase]);

  // Tap anywhere on intro: starts crossfade to login. Change 400/600 to tweak timing.
  const handleMainClick = () => {
    if (phase !== "intro") return;
    if (introFadingOut) return;

    setIntroFadingOut(true);

    introTimersRef.current.push(
      window.setTimeout(() => setLoginStarted(true), 400),
    );

    introTimersRef.current.push(
      window.setTimeout(() => {
        setPhase("login");
        setLoginStarted(false);
        setIntroFadingOut(false);
      }, 600),
    );
  };

  // Sign in: validates email/password; on success shows Casablanca quote then redirects.
  // Change "/home" to another path if you want to send users elsewhere after login.
  // Change 2500 to keep success screen visible longer/shorter before redirect; 1000 is delay before "Redirecting..." text.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!email.trim() || !password.trim()) {
      setShowToast(true);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setShowToast(false), 2500);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });
    if (error) {
      console.error("Sign in error:", error.message);
      setShowToast(true);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setShowToast(false), 2500);
      return;
    }

    setShowToast(false);
    setLoginExiting(true);

    if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
    if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current);

    loginTimersRef.current.push(
      window.setTimeout(() => {
        setPhase("success");
        setLoginExiting(false);
        setShowRedirecting(false);
        redirectTimerRef.current = window.setTimeout(
          () => setShowRedirecting(true),
          1000,
        );
      }, 500),
    );

    pushTimerRef.current = window.setTimeout(() => {
      router.push("/home");
    }, 2500);
  };

  const showIntroContent = phase === "intro";
  const showLoginContent = phase === "login" || loginStarted || loginExiting;

  return (
    <main
      className="relative h-screen w-screen overflow-hidden text-white"
      style={{ fontFamily: "var(--font-display)", background: "var(--background-base)" }}
      onClick={handleMainClick}
    >
      {/* Background: poster grid. Change opacity-[0.06] for stronger/softer posters; kenburns = slow zoom/drift (see CSS). */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="grid grid-cols-5 gap-6 opacity-[0.06] blur-sm scale-110 kenburns">
          {POSTERS.concat(POSTERS).map((src, i) => (
            <img
              key={i}
              src={src}
              className="w-full object-cover rounded-md"
              alt=""
            />
          ))}
        </div>
        {/* Warm glow + vignette. Edit the radial-gradient values to change darkness or gold tint. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(212,175,55,0.02) 0%, transparent 60%), radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 78%, var(--background-base) 100%)",
          }}
        />
      </div>

      {/* Film grain overlay: opacity and animation are in the <style> block (.film-grain). */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-soft-light film-grain" />

      {/* INTRO: centered copy + cycling quote. min-h below prevents quote from being clipped. */}
      {showIntroContent && (
        <div
          className={`relative z-10 flex h-full w-full flex-col items-center justify-center px-6 text-center transition-opacity duration-600 ease-out ${
            introFadingOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="max-w-3xl">
            <div className="text-[16px] uppercase tracking-[0.35em] text-[rgba(255,255,255,0.3)]">
              F D F S
            </div>
            <div className="mx-auto my-5 h-px w-[30px] bg-[rgba(255,255,255,0.1)]" />

            {/* Quote container: increase min-h if longer quotes get cut off; overflow-visible keeps text from clipping. */}
            <div className="relative mx-auto min-h-[180px] md:min-h-[140px] overflow-visible">
              <div
                className={`intro-quote transition-opacity duration-500 ease ${
                  introVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                {INTRO_QUOTES[introIndex]}
              </div>
            </div>

            <p className="mt-6 text-[14px] italic text-[rgba(255,255,255,0.3)]">
              Every film you loved. Every story you kept.
            </p>
          </div>

          {/* "tap to begin": pulse is .intro-prompt in <style>; change bottom-12 to move it up/down. */}
          {showTapPrompt && (
            <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 text-[12px] italic text-[rgba(255,255,255,0.25)] intro-prompt">
              tap to begin
            </div>
          )}
        </div>
      )}

      {/* LOGIN (split: left = quotes, right = card) and SUCCESS (Casablanca + redirect text). */}
      {(showLoginContent || phase === "success") && (
        <div
          className={`absolute inset-0 z-20 flex items-center justify-center px-4 transition-opacity duration-600 ease-out ${
            loginStarted || phase === "login" || loginExiting
              ? "opacity-100"
              : "opacity-0"
          }`}
          style={{
            pointerEvents: showLoginContent || phase === "success" ? "auto" : "none",
          }}
        >
          {phase !== "success" && (
            <div
              className={`w-full max-w-6xl transition-all duration-500 ease-out ${
                loginExiting ? "opacity-0 translate-y-[10px]" : "opacity-100"
              }`}
            >
              <div className="flex w-full flex-col md:flex-row">
                {/* Left: cinematic quotes + FDFS tagline. md:pl-16 = desktop left padding; adjust for layout. */}
                <div className="w-full md:w-1/2 md:pl-16 md:pr-8 px-2">
                  <div className="flex min-h-[280px] md:min-h-0 md:h-[70vh] flex-col justify-center">
                    <div
                      className={`text-[28px] italic transition-opacity duration-500 ease ${
                        narrativeVisible ? "opacity-100" : "opacity-0"
                      }`}
                      style={{ color: "rgba(212, 175, 55, 0.6)" }}
                    >
                      {NARRATIVE_QUOTES[narrativeIndex]}
                    </div>

                    <div className="mt-8 h-px w-10 bg-[rgba(255,215,0,0.1)]" />

                    <div className="mt-6 text-[12px] uppercase tracking-[0.3em] text-[rgba(255,255,255,0.25)]">
                      F D F S
                    </div>
                    <div className="mt-2 text-[12px] italic text-[rgba(255,255,255,0.15)]">
                      Your personal movie diary
                    </div>
                  </div>
                </div>

                {/* Right: login card. max-w-[400px] = card width; change padding (px-9 py-11) to make it more/less spacious. */}
                <div className="w-full md:w-1/2 md:pr-16 md:pl-8 px-2">
                  <div className="flex md:h-[70vh] flex-col justify-center md:items-start items-center">
                    <div
                      className="w-full max-w-[400px] rounded-[14px] border border-[rgba(255,255,255,0.05)] px-9 py-11 shadow-[0_20px_60px_rgba(0,0,0,0.5)] login-card-appear"
                      style={{
                        background: "rgba(20, 20, 24, 0.7)",
                        backdropFilter: "blur(20px)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Card heading and subheading: edit these strings to change the welcome message. */}
                      <div className="text-[20px] font-medium text-[rgba(255,255,255,0.85)]">
                        Welcome back.
                      </div>
                      <div className="mt-[6px] text-[13px] italic leading-relaxed text-[rgba(255,255,255,0.35)]">
                        &quot;We won&apos;t keep you waiting longer.&quot;
                      </div>

                      <div className="h-8" />

                      <form onSubmit={handleSubmit}>
                        <label className="mb-2 block text-[11px] uppercase tracking-[0.15em] text-[rgba(255,255,255,0.3)]">
                          EMAIL
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="&quot;What's in a name?&quot;"
                          className="fdfs-input w-full rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-[14px] py-3 text-[14px] text-[rgba(255,255,255,0.8)] outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />

                        <div className="mt-5">
                          <label className="mb-2 block text-[11px] uppercase tracking-[0.15em] text-[rgba(255,255,255,0.3)]">
                            PASSWORD
                          </label>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="&quot;I see dead passwords.&quot;"
                            className="fdfs-input w-full rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-[14px] py-3 text-[14px] text-[rgba(255,255,255,0.8)] outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        <div className="h-7" />

                        <button
                          type="submit"
                          className="w-full rounded-[8px] border border-[rgba(212,175,55,0.2)] px-4 py-[13px] text-[13px] font-medium tracking-[0.05em] transition-all duration-300 ease-out"
                          style={{
                            background: "rgba(212, 175, 55, 0.12)",
                            color: "rgba(212, 175, 55, 0.8)",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Sign in
                        </button>

                        <div className="my-5 flex items-center gap-3">
                          <span
                            className="h-px flex-1"
                            style={{
                              background:
                                "linear-gradient(90deg, transparent, rgba(255,255,255,0.06))",
                            }}
                          />
                          <span className="text-[10px] italic text-[rgba(255,255,255,0.2)]">
                            or
                          </span>
                          <span
                            className="h-px flex-1"
                            style={{
                              background:
                                "linear-gradient(90deg, rgba(255,255,255,0.06), transparent)",
                            }}
                          />
                        </div>

                        <div className="flex gap-[10px]">
                          <button
                            type="button"
                            className="flex-1 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-[11px] text-[12px] text-[rgba(255,255,255,0.4)] transition-all duration-300 ease-out hover:bg-[rgba(255,255,255,0.06)]"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await supabase.auth.signInWithOAuth({
                                provider: "google",
                                options: {
                                  redirectTo: `${window.location.origin}/auth/callback`,
                                },
                              });
                            }}
                          >
                            Google
                          </button>
                          <button
                            type="button"
                            className="flex-1 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-[11px] text-[12px] text-[rgba(255,255,255,0.4)] transition-all duration-300 ease-out hover:bg-[rgba(255,255,255,0.06)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Apple
                          </button>
                        </div>

                        <div className="mt-6 text-center text-[11px] italic text-[rgba(255,255,255,0.2)]">
                          Don&apos;t have an account?{" "}
                          <span className="signup-link">
                            Sign up
                          </span>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {phase === "success" && (
            <div className="px-6 text-center success-appear">
              {/* Success screen: edit quote and film credit; "Redirecting..." delay is 1000ms in handleSubmit. */}
              <div
                className="text-[28px] italic"
                style={{ color: "rgba(212, 175, 55, 0.6)" }}
              >
                &quot;Here&apos;s looking at you, kid.&quot;
              </div>
              <div className="mt-2 text-[12px] text-[rgba(255,255,255,0.2)]">
                Casablanca, 1942
              </div>
              <div
                className={`mt-4 text-[11px] text-[rgba(255,255,255,0.15)] transition-opacity duration-500 ease ${
                  showRedirecting ? "opacity-100" : "opacity-0"
                }`}
              >
                Redirecting to your diary...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validation error toast: message and styles can be changed; auto-dismiss is 2500ms in handleSubmit. */}
      {showToast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-10 z-30 flex justify-center px-4">
          <div className="pointer-events-auto rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(30,20,15,0.9)] px-6 py-[14px] text-[13px] italic text-[rgba(255,180,140,0.7)] toast">
            "Houston, we have a problem." — Apollo 13
          </div>
        </div>
      )}

      <style>{`
        /* Intro cycling quote: change font-size (32/48), color (rgba(212,175,55,0.75)), or weight for a different look. */
        .intro-quote {
          font-weight: 600;
          line-height: 1.2;
          letter-spacing: -0.02em;
          font-family: var(--font-display);
          font-style: italic;
          color: rgba(212, 175, 55, 0.75);
          font-size: 32px;
        }

        @media (min-width: 768px) {
          .intro-quote {
            font-size: 48px;
          }
        }

        /* "tap to begin" pulse: change 3s to speed up/slow down the opacity cycle. */
        .intro-prompt {
          animation: intro-prompt 3s ease-in-out infinite;
        }

        /* Background drift: change 36s for slower/faster Ken Burns effect. */
        .kenburns {
          animation: kenburns 36s ease-in-out infinite alternate;
        }

        /* Login card enter: duration and translateY are in keyframes below; edit for different entrance feel. */
        .login-card-appear {
          animation: login-card-appear 0.6s ease-out both;
        }

        .fdfs-input {
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
          font-family: var(--font-body);
        }

        .fdfs-input::placeholder {
          color: rgba(255, 255, 255, 0.2);
          font-style: italic;
          font-size: 12px;
        }

        .fdfs-input:focus {
          border-color: rgba(212, 175, 55, 0.4);
          box-shadow: 0 0 12px rgba(212, 175, 55, 0.05);
        }

        button[type="submit"]:hover {
          background: rgba(212, 175, 55, 0.18) !important;
          border-color: rgba(212, 175, 55, 0.3) !important;
        }

        .signup-link {
          color: rgba(212, 175, 55, 0.5);
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .signup-link:hover {
          color: rgba(212, 175, 55, 0.65);
        }

        .toast {
          animation: toast-in 0.5s ease-out both;
        }

        .success-appear {
          animation: success-in 0.6s ease-out both;
        }

        @keyframes intro-prompt {
          0% {
            opacity: 0.15;
          }
          50% {
            opacity: 0.35;
          }
          100% {
            opacity: 0.15;
          }
        }

        @keyframes kenburns {
          0% {
            transform: scale(1.05) translateY(0px);
          }
          100% {
            transform: scale(1.1) translateY(-20px);
          }
        }

        @keyframes login-card-appear {
          0% {
            opacity: 0;
            transform: translateY(15px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes toast-in {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes success-in {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .film-grain {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.9'/%3E%3C/svg%3E");
          background-size: 160px 160px;
          animation: grainMove 0.5s steps(1) infinite;
        }

        @keyframes grainMove {
          0% {
            background-position: 0 0;
          }
          50% {
            background-position: 40px -40px;
          }
          100% {
            background-position: -40px 40px;
          }
        }
      `}</style>
    </main>
  );
}