import React from 'react';
import { Grid, Paper, Typography, List, ListItem, ListItemText, Divider, Box } from '@mui/material';
import ChatInterface from '../components/ChatInterface';
import useChatStore from '../store/chatStore';

const MainPage: React.FC = () => {
  const { currentOrder } = useChatStore();
  console.log('MainPage currentOrder:', currentOrder);

  return (
    <Grid container spacing={2} sx={{ height: '100vh', p: 2 }}>
      {/* Chat Interface */}
      <Grid item xs={12} md={8} sx={{ height: '100%' }}>
        <ChatInterface />
      </Grid>

      {/* Order Status */}
      <Grid item xs={12} md={4} sx={{ height: '100%' }}>
        <Paper sx={{ height: '100%', p: 2, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h5" gutterBottom>
            주문 현황
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {currentOrder && currentOrder.orderId ? (
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">{currentOrder.storeName}</Typography>
              <List sx={{ flexGrow: 1, overflow: 'auto' }}>
                {currentOrder.items.map((item, index) => (
                  <ListItem key={index} disablePadding>
                    <ListItemText 
                      primary={`${item.name} x ${item.quantity}`}
                      secondary={`${(item.price * item.quantity).toLocaleString()}원`}
                      primaryTypographyProps={{ fontWeight: 'bold' }}
                    />
                  </ListItem>
                ))}
              </List>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">총 금액:</Typography>
                <Typography variant="h6" fontWeight="bold">
                  {currentOrder.totalPrice.toLocaleString()}원
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="subtitle1" color="text.secondary">
                주문 내역이 없습니다.
              </Typography>
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
};

export default MainPage;
