# HCA Central Command Deployment Runbook

## Deployment Model

HCA Central Command uses a **Personal Machine Active Host With Shared Backup Handoff** deployment model.

This means John or Malkolm can host the app from a personal machine, but only one machine should be the active host at any time.

The active host runs:

- the Next.js app server
- the local SQLite database
- the background market data refresh scheduler

Everyone else accesses the active host in a browser.

---

## Core Rule

There must be exactly one active host at a time.

John hosts HCA
Malkolm opens John's HCA URL

or

Malkolm hosts HCA
John opens Malkolm's HCA URL
