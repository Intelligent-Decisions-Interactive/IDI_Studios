update public.autobattle_products
set paid_tokens = case sku
        when 'tokens_25' then 25
        when 'tokens_50' then 60
        when 'tokens_100' then 135
        when 'tokens_250' then 360
        when 'tokens_500' then 750
    end,
    bonus_tokens = case sku
        when 'tokens_25' then 5
        when 'tokens_50' then 10
        when 'tokens_100' then 25
        when 'tokens_250' then 90
        when 'tokens_500' then 250
    end,
    featured = false,
    updated_at = now()
where sku in ('tokens_25', 'tokens_50', 'tokens_100', 'tokens_250', 'tokens_500');

update public.autobattle_products
set featured = false,
    updated_at = now()
where featured;
