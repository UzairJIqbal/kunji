# Phase 12 — New order notifications

## Goal

The moment a customer submits payment proof, the seller hears about it on their phone or laptop and in their email, so no order sits unseen in the queue.

## Where this starts

When proof lands, the order moves to *verifying* and appears live in the verification queue. If the seller isn't looking at the queue, nothing reaches them.

## Build

- **A browser notification (Web Push)** to every device where the seller has switched notifications on. Tapping it opens the verification queue.
- **An email** to the seller's address through Resend: order number, amount, payment method and a link to the queue. Plain text, one short subject line such as "Payment to check: order #1042".
- **Both are sent when an order enters *verifying***. Proof sent again for the same order (for example after a rejection) sends again; nothing else does.
- **A notifications page in the admin area.** A button that asks this browser for permission and registers it, a list of registered devices with a remove button, a "Send a test" button, and an on/off switch for each channel: browser push and email.

## Constraints

- **A notification never changes an order.** An order only becomes *paid* when the seller approves it in the Phase 6 queue. Nothing in this phase approves, rejects or moves anything.
- **What a notification may contain:** order number, amount, payment method and the queue link. Never the receipt image, the customer's name, email, phone or wallet number, or anything about the product's login.
- **A failed notification never blocks the order.** If Resend is down, a push subscription has expired, or permission was never given, the proof is still saved and the failure is one line in the server log. The queue is the source of truth.
- **An expired push subscription is removed** the first time sending to it fails, so it doesn't fail every time.
- **Keys live only in the server's environment:** the Resend API key and the VAPID private key. The VAPID public key is the only one the browser ever sees.
- **Push subscriptions are admin-only rows**, readable and writable by policy only by admins, like everything else.
- **No new paid service.** Resend's free plan. Without a verified domain, Resend only sends to the address of the Resend account itself, so the seller signs up to Resend with the email that should receive these.
- If a package is needed for Web Push, name it and wait before installing. The email is one HTTP call to Resend; no SDK.

## Acceptance check

1. On the admin notifications page, switch on browser notifications on your laptop and on your Android phone. Both appear in the device list.
2. As a customer, submit proof on an order. Within a few seconds a browser notification arrives on both devices and an email arrives in your inbox. Each shows only the order number, amount and method.
3. Tap the notification. The verification queue opens. The order is still *verifying*.
4. Turn email off and submit proof on another order. The push arrives, the email doesn't.
5. Put a wrong Resend key in the environment and submit proof. The order still reaches the queue, and the server log says the email failed.
6. Remove a device from the list and submit proof. That device gets nothing.
7. Search the email and the notification for the customer's name, email and wallet number. None of them is there.

## Not in this phase

Notifications to customers. SMS or WhatsApp messages. Approving payments automatically in any form. A custom email domain.
