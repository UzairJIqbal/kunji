import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/action-button";
import { NotAdmin } from "@/components/admin/not-admin";
import {
  PaymentAccountForm,
  blankPaymentAccount,
} from "@/components/admin/payment-account-form";
import {
  createPaymentAccount,
  setPaymentAccountActive,
  updatePaymentAccount,
} from "@/lib/actions/payment-accounts";
import { viewerSeesAdminRows } from "@/lib/data/admin";
import { listPaymentAccounts } from "@/lib/data/payment-accounts";

export const metadata: Metadata = { title: "Payment accounts · Admin · Kunji" };

export default function PaymentAccountsPage() {
  return (
    <main className="mt-3 max-w-3xl">
      <h1 className="font-heading text-xl leading-tight">Payment accounts</h1>
      <p className="mt-0.5 text-muted-foreground">
        The wallet and bank accounts customers pay into. Switched-off accounts aren&apos;t shown
        at checkout.
      </p>
      <Suspense fallback={<p className="mt-2 text-muted-foreground">Loading accounts…</p>}>
        <AccountList />
      </Suspense>
    </main>
  );
}

async function AccountList() {
  const [isAdmin, accounts] = await Promise.all([viewerSeesAdminRows(), listPaymentAccounts()]);
  if (!isAdmin) return <NotAdmin />;

  return (
    <>
      {accounts.length === 0 && (
        <p className="mt-3 text-muted-foreground">No payment accounts yet. Add one below.</p>
      )}
      <ul className="mt-3 divide-y border-y">
        {accounts.map((account) => (
          <li key={account.id} className="py-3">
            <div className="mb-1.5 flex items-center gap-3">
              <span className={account.active ? "font-medium text-success" : "text-muted-foreground"}>
                {account.active ? "On" : "Off"}
              </span>
              <ActionButton
                action={setPaymentAccountActive.bind(null, account.id, !account.active)}
                label={account.active ? "Switch off" : "Switch on"}
                pendingLabel="Saving…"
              />
            </div>
            <PaymentAccountForm
              action={updatePaymentAccount.bind(null, account.id)}
              initial={{
                method: account.method,
                accountTitle: account.account_title,
                accountNumber: account.account_number,
                bankName: account.bank_name ?? "",
              }}
              submitLabel="Save account"
            />
          </li>
        ))}
      </ul>

      <h2 className="mt-4 text-xs font-medium text-muted-foreground">Add an account</h2>
      <div className="mt-1.5">
        <PaymentAccountForm
          action={createPaymentAccount}
          initial={blankPaymentAccount}
          submitLabel="Add account"
          clearOnSave
        />
      </div>
    </>
  );
}
