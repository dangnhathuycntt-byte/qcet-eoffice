import React from 'react';
import { Tabs, TabsList, TabsTrigger } from 'qcet-eoffice';

export function Default() {
  return (
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Tổng quan</TabsTrigger>
        <TabsTrigger value="tab2">Hoạt động</TabsTrigger>
        <TabsTrigger value="tab3">Văn bản liên quan</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
