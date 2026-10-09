import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from 'qcet-eoffice';

export function Default() {
  return (
    <Tabs defaultValue="tab1" className="w-80">
      <TabsList>
        <TabsTrigger value="tab1">Tổng quan</TabsTrigger>
        <TabsTrigger value="tab2">Chi tiết</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="mt-2.5 p-3 rounded-xl bg-secondary text-xs text-foreground">
        Nội dung tab Tổng quan được hiển thị tại đây.
      </TabsContent>
    </Tabs>
  );
}
