import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { customerApi, saleOrderApi } from '@/lib/api';
import { Invoice, Customer, SaleOrder, UserRole } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface InvoiceModuleProps {
  userRole: UserRole;
}

export const InvoiceModule = ({ userRole }: InvoiceModuleProps) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<SaleOrder[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [apiCustomers, apiSales] = await Promise.all([
        customerApi.getAll(),
        saleOrderApi.getAll(),
      ]);
      setCustomers(apiCustomers);
      setSales(apiSales);
      // TODO: Load invoices from API when invoice API is available
      setInvoices([]);
    } catch (error) {
      console.error('Error loading data:', error);
      setInvoices([]);
      setCustomers([]);
      setSales([]);
    }
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Unknown';
  const getSaleOrderNumber = (id: string) => sales.find(s => s.id === id)?.orderNumber || 'Unknown';

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'default';
      case 'partial': return 'secondary';
      case 'overdue': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Management</CardTitle>
        <CardDescription>View and manage customer invoices and payments</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Sale Order</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No invoices found
                </TableCell>
              </TableRow>
            ) : (
              invoices.map(invoice => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{getCustomerName(invoice.customerId)}</TableCell>
                  <TableCell>{getSaleOrderNumber(invoice.saleOrderId)}</TableCell>
                  <TableCell>PKR {invoice.totalAmount.toLocaleString()}</TableCell>
                  <TableCell>PKR {invoice.paidAmount.toLocaleString()}</TableCell>
                  <TableCell>PKR {invoice.balanceAmount.toLocaleString()}</TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
