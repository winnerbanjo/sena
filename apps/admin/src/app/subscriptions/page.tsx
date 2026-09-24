import { db, subscriptions, organizations } from '@sena/database';
import { eq, desc } from 'drizzle-orm';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@sena/ui';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
  const allSubs = await db
    .select({
      id: subscriptions.id,
      orgName: organizations.name,
      plan: subscriptions.plan,
      billingCycle: subscriptions.billingCycle,
      status: subscriptions.status,
      amount: subscriptions.amountMinorUnits,
      createdAt: subscriptions.createdAt,
      periodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .leftJoin(organizations, eq(subscriptions.organizationId, organizations.id))
    .orderBy(desc(subscriptions.createdAt));

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[#E8E2DA] bg-white py-4 px-6">
        <div>
          <h1 className="text-xl font-serif text-[#191816]">Subscriptions</h1>
          <p className="text-xs text-[#7A7267] mt-0.5">Billing and SaaS plans for managed properties/organizations.</p>
        </div>
      </header>

      <main className="p-6">
        <div className="bg-white border border-[#E8E2DA] rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA]">
                <TableHead>Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Amount (₦)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Next Renewal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allSubs.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <strong className="text-sm font-medium">{sub.orgName || 'N/A'}</strong>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">{sub.id}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{sub.plan}</Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{sub.billingCycle}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {(sub.amount / 100).toLocaleString('en-NG')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      sub.status === 'active' ? 'clean' : 
                      sub.status === 'trialing' ? 'pending' : 'outline'
                    }>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {new Date(sub.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {new Date(sub.periodEnd).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {allSubs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500 text-sm">
                    No subscriptions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
