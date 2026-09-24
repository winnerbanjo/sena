import { db, properties, organizations } from '@sena/database';
import { eq, desc } from 'drizzle-orm';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@sena/ui';
import Link from 'next/link';
import { Eye } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PropertiesPage() {
  const allProperties = await db
    .select({
      id: properties.id,
      name: properties.name,
      code: properties.code,
      type: properties.propertyType,
      city: properties.address,
      createdAt: properties.createdAt,
      orgName: organizations.name,
    })
    .from(properties)
    .leftJoin(organizations, eq(properties.organizationId, organizations.id))
    .orderBy(desc(properties.createdAt));

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[#E8E2DA] bg-white py-4 px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-serif text-[#191816]">Properties Directory</h1>
          <p className="text-xs text-[#7A7267] mt-0.5">List of all properties on the Sena platform.</p>
        </div>
      </header>

      <main className="p-6">
        <div className="bg-white border border-[#E8E2DA] rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA]">
                <TableHead>Property</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allProperties.map((prop) => (
                <TableRow key={prop.id}>
                  <TableCell>
                    <strong className="text-sm font-medium">{prop.name}</strong>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs px-1.5 py-0.5 bg-gray-100 rounded">{prop.code}</span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{prop.orgName || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{prop.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">{prop.city}</TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {new Date(prop.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/properties/${prop.id}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {allProperties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500 text-sm">
                    No properties found.
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
