"""Test DigiKey API Integration"""
from app.plugins.suppliers.digikey import DigiKeyPlugin
from app.config import settings

config = {
    'client_id': settings.digikey_client_id,
    'client_secret': settings.digikey_client_secret,
    'access_token': settings.digikey_access_token,
    'base_url': settings.digikey_base_url,
    'sandbox': settings.digikey_sandbox,
    'enabled': True
}

plugin = DigiKeyPlugin(config)
print('\n🔍 Testing DigiKey API Integration')
print('='*60)
result = plugin.get_product_details('ATMEGA328P-PU', 'Microchip')

if result:
    print('✅ DigiKey API: SUCCESS!')
    print()
    print(f'MPN:          {result.mpn}')
    print(f'Manufacturer: {result.manufacturer}')
    print(f'Description:  {result.description}')
    print(f'Availability: {result.availability} units')
    print(f'Unit Price:   ${result.unit_price} {result.currency}')
    print(f'Price Breaks: {len(result.price_breaks)} tiers')
    if result.price_breaks:
        for i, pb in enumerate(result.price_breaks[:3], 1):
            print(f'  {i}. {pb["quantity"]:>4} units @ ${pb["price"]}')
    print(f'Lifecycle:    {result.lifecycle_status}')
    print(f'Category:     {result.category}')
    print(f'Supplier SKU: {result.supplier_sku}')
    if result.lead_time_days:
        print(f'Lead Time:    {result.lead_time_days} days')
    else:
        print('Lead Time:    N/A')
    print(f'Datasheet:    {result.datasheet_url[:60] if result.datasheet_url else "N/A"}...')
    print(f'Image:        {result.image_url[:60] if result.image_url else "N/A"}...')
    print(f'Parameters:   {len(result.parameters)} technical specs')

    # Show some parameters
    if result.parameters:
        print('\nSample Parameters:')
        for key, value in list(result.parameters.items())[:5]:
            print(f'  - {key}: {value}')

    print('\n' + '='*60)
else:
    print('❌ DigiKey API: FAILED')
