import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { customerApi } from '@/lib/api';
import { Customer, Invoice, UserRole } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface ReceivablesModuleProps {
  userRole: UserRole;
}

interface CustomerBalance {
  customer: Customer;
  totalDue: number;
  overdueAmount: number;
  age0to30: number;
  age31to60: number;
  age61to90: number;
  age90plus: number;
  hasAlert: boolean;
  alertMessage: string;
}

export const ReceivablesModule = ({ userRole }: ReceivablesModuleProps) => {
  const [customersBalances, setCustomersBalances] = useState<CustomerBalance[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const customers = await customerApi.getAll();
      // TODO: Load invoices from API when invoice API is available
      const invoices: Invoice[] = [];
      
      const today = new Date();
      const newAlerts: string[] = [];

      const balances: CustomerBalance[] = customers.map(customer => {
      const customerInvoices = invoices.filter(inv => inv.customerId === customer.id);
      let totalDue = 0;
      let overdueAmount = 0;
      let age0to30 = 0;
      let age31to60 = 0;
      let age61to90 = 0;
      let age90plus = 0;

      customerInvoices.forEach(invoice => {
        if (invoice.status !== 'paid') {
          const balance = invoice.balanceAmount;
          totalDue += balance;

          const dueDate = new Date(invoice.dueDate);
          const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysOverdue > 0) {
            overdueAmount += balance;
          }

          if (daysOverdue <= 30) {
            age0to30 += balance;
          } else if (daysOverdue <= 60) {
            age31to60 += balance;
          } else if (daysOverdue <= 90) {
            age61to90 += balance;
          } else {
            age90plus += balance;
          }
        }
      });

      let hasAlert = false;
      let alertMessage = '';

      // Check credit limit
      if (!customer.isCashOnly && totalDue > customer.creditLimit) {
        hasAlert = true;
        alertMessage = `Exceeding credit limit by PKR ${(totalDue - customer.creditLimit).toLocaleString()}`;
        newAlerts.push(`${customer.name}: ${alertMessage}`);
      }

      // Check overdue
      if (overdueAmount > 0) {
        hasAlert = true;
        const overdueMsg = `Overdue amount: PKR ${overdueAmount.toLocaleString()}`;
        alertMessage = alertMessage ? `${alertMessage}; ${overdueMsg}` : overdueMsg;
        if (!newAlerts.some(a => a.includes(customer.name))) {
          newAlerts.push(`${customer.name}: ${overdueMsg}`);
        }
      }

      return {
        customer,
        totalDue,
        overdueAmount,
        age0to30,
        age31to60,
        age61to90,
        age90plus,
        hasAlert,
        alertMessage,
      };
    });

      setCustomersBalances(balances.filter(b => b.totalDue > 0 || !b.customer.isCashOnly));
      setAlerts(newAlerts);
    } catch (error) {
      console.error('Error loading data:', error);
      setCustomersBalances([]);
      setAlerts([]);
    }
  };

  const getAgingColor = (amount: number, totalDue: number) => {
    if (amount === 0) return 'text-muted-foreground';
    const percentage = (amount / totalDue) * 100;
    if (percentage > 50) return 'text-destructive font-semibold';
    if (percentage > 25) return 'text-orange-600 font-semibold';
    return 'text-foreground';
  };

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">Credit Alerts:</div>
            <ul className="list-disc list-inside space-y-1">
              {alerts.map((alert, idx) => (
                <li key={idx}>{alert}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Accounts Receivable - Aging Report</CardTitle>
          <CardDescription>Track outstanding customer balances by aging buckets</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead>Total Due</TableHead>
                <TableHead className="text-right">0-30 Days</TableHead>
                <TableHead className="text-right">31-60 Days</TableHead>
                <TableHead className="text-right">61-90 Days</TableHead>
                <TableHead className="text-right">90+ Days</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customersBalances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No receivables found
                  </TableCell>
                </TableRow>
              ) : (
                customersBalances.map(({ customer, totalDue, age0to30, age31to60, age61to90, age90plus, hasAlert, alertMessage }) => (
                  <TableRow key={customer.id} className={hasAlert ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.city}</TableCell>
                    <TableCell>
                      {customer.isCashOnly ? (
                        <Badge variant="secondary">Cash Only</Badge>
                      ) : (
                        `PKR ${customer.creditLimit.toLocaleString()}`
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">PKR {totalDue.toLocaleString()}</TableCell>
                    <TableCell className={`text-right ${getAgingColor(age0to30, totalDue)}`}>
                      {age0to30 > 0 ? `PKR ${age0to30.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className={`text-right ${getAgingColor(age31to60, totalDue)}`}>
                      {age31to60 > 0 ? `PKR ${age31to60.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className={`text-right ${getAgingColor(age61to90, totalDue)}`}>
                      {age61to90 > 0 ? `PKR ${age61to90.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell className={`text-right ${getAgingColor(age90plus, totalDue)}`}>
                      {age90plus > 0 ? `PKR ${age90plus.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell>
                      {hasAlert ? (
                        <Badge variant="destructive" className="whitespace-nowrap">
                          Alert
                        </Badge>
                      ) : totalDue > 0 ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Current</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
