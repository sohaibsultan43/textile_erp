import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const TradeOfferModule: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade Offer Management</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Manage and create trade offers here.</p>
        {/* TODO: Implement trade offer listing and creation UI */}
      </CardContent>
    </Card>
  );
};

export default TradeOfferModule;
