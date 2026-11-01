grant select on table public.products to anon, authenticated;

drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
  on public.products
  for select
  to anon, authenticated
  using (is_active = true);
