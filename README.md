# 🎈 PartyHost

Planning a kids' party usually means juggling five different apps at once—Pinterest for ideas, ChatGPT for prompts, WhatsApp for group chats, Excel for budgets, and Notes for endless checklists. Things get lost, and it quickly turns into dynamic chaos.

I built **PartyHost** to fix this. It’s a single dashboard that acts as the "single source of truth" for family event ops—bringing AI ideation, dynamic timelines, budget tracking, live guest RSVPs, and printable execution together in one place.

## 🚀 Live Demo
- **Web App:** [https://ideen-board.vercel.app](https://ideen-board.vercel.app)

---

## ✨ What PartyHost Does

* **AI Board Setup (OpenAI GPT-5.6):** Enter a theme (e.g., *"Luna's 7th Birthday Unicorn Party"*) and PartyHost automatically generates tailored activity ideas, a structured timeline, and a shopping list.
* **1-Click Rain-Check:** Weather forecast showing rain? One click rebuilds the schedule for an indoor backup plan without ruining the event flow.
* **Budget & RSVP Tracker:** Track shopping expenses against a set budget and manage guest RSVPs in real time with 1-click WhatsApp invites.
* **1-Click Printable Master Plan:** On party day, parents don't want to tap on phone screens with sticky fingers around. One click generates a clean, high-contrast 1-page PDF summary covering the schedule, contacts, and lists to stick right on the fridge.

---

## 🛠️ How I Built It

As a first-time builder, I constructed this full-stack application using the **Codex CLI** to connect and structure the entire architecture.

* **AI Engine:** OpenAI GPT-5.6
* **Build Tool:** Codex CLI (Session ID: `019f64ab-1685-7350-a3f3-23a15fa616fe`)
* **Frontend:** React, TypeScript, Tailwind CSS
* **Database & Hosting:** Neon Postgres, deployed on Vercel
