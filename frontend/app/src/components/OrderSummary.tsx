import React from 'react';
import { Box, Paper, Typography, List, ListItem, ListItemText, Divider, Button } from '@mui/material';
import { useOrderStore } from '../store/orderStore';

const OrderSummary = () => {
  const { items, totalPrice, clearCart } = useOrderStore();

  return (
    <Paper elevation={3} sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        주문 현황
      </Typography>
      <Divider sx={{ mb: 1 }} />
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          장바구니가 비어있습니다.
        </Typography>
      ) : (
        <List dense>
          {items.map((item) => (
            <ListItem key={item.name} secondaryAction={<Typography>{item.price.toLocaleString()}원</Typography>}>
              <ListItemText primary={`${item.name} x ${item.quantity}`} />
            </ListItem>
          ))}
        </List>
      )}
      <Divider sx={{ mt: 1 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Typography variant="h6">총 금액:</Typography>
        <Typography variant="h6">{totalPrice.toLocaleString()}원</Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
        <Button variant="contained" color="primary" disabled={items.length === 0}>
          주문 확정
        </Button>
        <Button variant="outlined" color="error" onClick={clearCart} disabled={items.length === 0}>
          전체 취소
        </Button>
      </Box>
    </Paper>
  );
};

export default OrderSummary;
