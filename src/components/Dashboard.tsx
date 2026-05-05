import { useState, useEffect } from 'react';
import { getCurrentUser, logout } from '@/lib/auth';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Package, Users, Warehouse, ShoppingCart, FileText, TruckIcon, ShoppingBag, Factory, Building2, UserCog, Wallet, CheckCircle } from 'lucide-react';
import { StockManagement } from './modules/StockManagement';
import { SalesModule } from './modules/SalesModule';
import { CustomerManagement } from './modules/CustomerManagement';
import { VendorManagement } from './modules/VendorManagement';
import { GatePassModule } from './modules/GatePassModule';
import { InvoiceModule } from './modules/InvoiceModule';
import { ReportsModule } from './modules/ReportsModule';
import { StockTransferModule } from './modules/StockTransferModule';
import { ReceivablesModule } from './modules/ReceivablesModule';
import { ArticleManagement } from './modules/ArticleManagement';
import { PurchaseModule } from './modules/PurchaseModule';
import { ProductionModule } from './modules/ProductionModule';
import { DyeingProductionModule } from './modules/DyeingProductionModule';
import { WarehouseModule } from './modules/WarehouseModule';
import { UserManagement } from './modules/UserManagement';
import { ApprovalsModule } from './modules/ApprovalsModule';

interface DashboardProps {
  onLogout: () => void;
}

export const Dashboard = ({ onLogout }: DashboardProps) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
  }, []);

  const handleLogout = () => {
    logout();
    onLogout();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Textile ERP System</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user.name} ({user.role})</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="stock" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="stock" className="text-xs">
              <Warehouse className="mr-1 h-3 w-3" />
              Stock
            </TabsTrigger>
            <TabsTrigger value="articles" className="text-xs">
              <Package className="mr-1 h-3 w-3" />
              Articles
            </TabsTrigger>
            <TabsTrigger value="purchase" className="text-xs">
              <ShoppingBag className="mr-1 h-3 w-3" />
              Purchase
            </TabsTrigger>
            <TabsTrigger value="production" className="text-xs">
              <Factory className="mr-1 h-3 w-3" />
              Production
            </TabsTrigger>
            <TabsTrigger value="dyeing" className="text-xs">
              <Factory className="mr-1 h-3 w-3" />
              Dyeing Flow
            </TabsTrigger>
            <TabsTrigger value="transfer" className="text-xs">
              <TruckIcon className="mr-1 h-3 w-3" />
              Transfer
            </TabsTrigger>
            <TabsTrigger value="sales" className="text-xs">
              <ShoppingCart className="mr-1 h-3 w-3" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="gatepass" className="text-xs">
              <Package className="mr-1 h-3 w-3" />
              Gate Pass
            </TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs">
              <FileText className="mr-1 h-3 w-3" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="receivables" className="text-xs">
              <FileText className="mr-1 h-3 w-3" />
              Receivables
            </TabsTrigger>
            <TabsTrigger value="customers" className="text-xs">
              <Users className="mr-1 h-3 w-3" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="vendors" className="text-xs">
              <Building2 className="mr-1 h-3 w-3" />
              Vendors
            </TabsTrigger>
            <TabsTrigger value="warehouse" className="text-xs">
              <Warehouse className="mr-1 h-3 w-3" />
              Warehouse
            </TabsTrigger>
            {user.role === 'owner' && (
              <TabsTrigger value="users" className="text-xs">
                <UserCog className="mr-1 h-3 w-3" />
                Users
              </TabsTrigger>
            )}
            {(user.role === 'owner' || user.role === 'warehouse') && (
              <TabsTrigger
                value="approvals"
                className="text-xs font-semibold bg-emerald-100 text-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
              >
                <CheckCircle className="mr-1 h-3 w-3" />
                Approvals
              </TabsTrigger>
            )}
            <TabsTrigger value="reports" className="text-xs">
              <FileText className="mr-1 h-3 w-3" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="space-y-4 animate-in fade-in-50 duration-300">
            <StockManagement userRole={user.role} />
          </TabsContent>

          <TabsContent value="articles" className="space-y-4 animate-in fade-in-50 duration-300">
            <ArticleManagement userRole={user.role} />
          </TabsContent>

          <TabsContent value="purchase" className="space-y-4 animate-in fade-in-50 duration-300">
            <PurchaseModule userRole={user.role} userId={user.id} />
          </TabsContent>

          <TabsContent value="production" className="space-y-4 animate-in fade-in-50 duration-300">
            <ProductionModule userRole={user.role} userId={user.id} />
          </TabsContent>

          <TabsContent value="dyeing" className="space-y-4 animate-in fade-in-50 duration-300">
            <DyeingProductionModule />
          </TabsContent>

          <TabsContent value="transfer" className="space-y-4 animate-in fade-in-50 duration-300">
            <StockTransferModule userRole={user.role} userId={user.id} />
          </TabsContent>

          <TabsContent value="sales" className="space-y-4 animate-in fade-in-50 duration-300">
            <SalesModule userRole={user.role} userId={user.id} />
          </TabsContent>

          <TabsContent value="gatepass" className="space-y-4 animate-in fade-in-50 duration-300">
            <GatePassModule userRole={user.role} userId={user.id} />
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4 animate-in fade-in-50 duration-300">
            <InvoiceModule userRole={user.role} />
          </TabsContent>

          <TabsContent value="receivables" className="space-y-4 animate-in fade-in-50 duration-300">
            <ReceivablesModule userRole={user.role} />
          </TabsContent>

          <TabsContent value="customers" className="space-y-4 animate-in fade-in-50 duration-300">
            <CustomerManagement userRole={user.role} />
          </TabsContent>

          <TabsContent value="vendors" className="space-y-4 animate-in fade-in-50 duration-300">
            <VendorManagement userRole={user.role} />
          </TabsContent>

          <TabsContent value="warehouse" className="space-y-4 animate-in fade-in-50 duration-300">
            <WarehouseModule userRole={user.role} />
          </TabsContent>

          {user.role === 'owner' && (
            <TabsContent value="users" className="space-y-4 animate-in fade-in-50 duration-300">
              <UserManagement userRole={user.role} />
            </TabsContent>
          )}

          {(user.role === 'owner' || user.role === 'warehouse') && (
            <TabsContent value="approvals" className="space-y-4 animate-in fade-in-50 duration-300">
              <ApprovalsModule userRole={user.role} userId={user.id} />
            </TabsContent>
          )}

          <TabsContent value="reports" className="space-y-4 animate-in fade-in-50 duration-300">
            <ReportsModule userRole={user.role} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
