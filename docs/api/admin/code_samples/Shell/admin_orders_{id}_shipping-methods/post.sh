curl -X POST 'https://medusa-url.com/admin/orders/{id}/shipping-methods' \
-H 'Authorization: Bearer {api_token}' \
-H 'Content-Type: application/json' \
--data-raw '{
    "price": 1000,
    "option_id": "{option_id}"
}'
