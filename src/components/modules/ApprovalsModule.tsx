import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { POApprovalModule } from './POApprovalModule';
import { GRNApprovalModule } from './GRNApprovalModule';
import { StockRequisitionApprovalModule } from './StockRequisitionApprovalModule';
import { ShoppingBag, Package, Truck } from 'lucide-react';
import { UserRole } from '@/types';

export interface ApprovalsModuleProps {
  userRole: UserRole;
  userId: string;
}

export const ApprovalsModule: React.FC<ApprovalsModuleProps> = ({ userRole, userId }) => {
  const isOwner = userRole === 'owner';

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <StockRequisitionApprovalModule userRole={userRole} userId={userId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="po" className="w-full">
        <TabsList className="grid h-auto w-full max-w-3xl grid-cols-3 gap-1">
          <TabsTrigger value="po" className="flex items-center gap-2 text-xs sm:text-sm">
            <ShoppingBag className="h-4 w-4 shrink-0" />
            <span className="truncate">Purchase Orders</span>
          </TabsTrigger>
          <TabsTrigger value="grn" className="flex items-center gap-2 text-xs sm:text-sm">
            <Package className="h-4 w-4 shrink-0" />
            <span className="truncate">Goods Receipts</span>
          </TabsTrigger>
          <TabsTrigger value="requisitions" className="flex items-center gap-2 text-xs sm:text-sm">
            <Truck className="h-4 w-4 shrink-0" />
            <span className="truncate">Stock requisitions</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="po" className="mt-4 outline-none">
          <POApprovalModule />
        </TabsContent>

        <TabsContent value="grn" className="mt-4 outline-none">
          <GRNApprovalModule />
        </TabsContent>

        <TabsContent value="requisitions" className="mt-4 outline-none">
          <StockRequisitionApprovalModule userRole={userRole} userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
