import { db, users } from '@sena/database';
import { desc } from 'drizzle-orm';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@sena/ui';
import { User } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const allUsers = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(100);

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[#E8E2DA] bg-white py-4 px-6">
        <div>
          <h1 className="text-xl font-serif text-[#191816]">Users Directory</h1>
          <p className="text-xs text-[#7A7267] mt-0.5">Platform users, including hotel staff and guests (top 100 shown).</p>
        </div>
      </header>

      <main className="p-6">
        <div className="bg-white border border-[#E8E2DA] rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA]">
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <strong className="text-sm font-medium">{user.fullName}</strong>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{user.email}</TableCell>
                  <TableCell className="text-sm text-gray-600">{user.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? 'clean' : 'outline'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {allUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500 text-sm">
                    No users found.
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
