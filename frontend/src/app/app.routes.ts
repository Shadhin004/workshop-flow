import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { MaterialsComponent } from './features/materials/materials.component';
import { OrdersComponent } from './features/orders/orders.component';
import { ProductsComponent } from './features/products/products.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent, title: 'Dashboard — WorkshopFlow' },
  { path: 'materials', component: MaterialsComponent, title: 'Materials — WorkshopFlow' },
  { path: 'products', component: ProductsComponent, title: 'Products & BOM — WorkshopFlow' },
  { path: 'orders', component: OrdersComponent, title: 'Production Orders — WorkshopFlow' },
  { path: '**', redirectTo: 'dashboard' },
];
