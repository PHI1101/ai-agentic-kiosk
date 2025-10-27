// --- Mock 데이터베이스 (변경 없음) ---
const stores = [
  {
    id: 'store_kimbap',
    name: '김밥천국 중앙점',
    distance: '300m',
    menu: [
      { id: 1, name: '참치김밥', price: 4500, options: [] },
      { id: 2, name: '야채김밥', price: 3500, options: [] },
      { id: 3, name: '라볶이', price: 6000, options: [{ name: '치즈 추가', price: 1000 }] },
      { id: 4, name: '돈까스', price: 8000, options: [] },
    ],
  },
  {
    id: 'store_cafe',
    name: '스타벅스 강남점',
    distance: '500m',
    menu: [
      { id: 10, name: '아메리카노', price: 4100, options: [{ name: '샷 추가', price: 500 }] },
      { id: 11, name: '카페라떼', price: 4600, options: [] },
    ],
  },
];

// --- Helper Functions (상태를 인자로 받도록 수정) ---

const getInitialOrderState = () => ({
  storeId: null,
  storeName: null,
  items: [],
  totalPrice: 0,
  status: 'pending',
  paymentMethod: null,
  pickupTime: null,
  pickupTimeDate: null,
});

const calculateTotalPrice = (order) => {
  let total = 0;
  order.items.forEach(item => {
    let itemPrice = item.price * item.quantity;
    item.options.forEach(option => {
      itemPrice += option.price;
    });
    total += itemPrice;
  });
  order.totalPrice = total;
  return order;
};

const generatePickupTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  return { timeString: `${now.getHours()}시 ${now.getMinutes()}분`, dateTime: now.toISOString() };
};

const numberWordMap = {
    '한': 1, '하나': 1, '두': 2, '둘': 2, '세': 3, '셋': 3, '네': 4, '넷': 4,
    '다섯': 5, '여섯': 6, '일곱': 7, '여덟': 8, '아홉': 9, '열': 10,
};

const parseQuantity = (quantityStr) => {
    if (!quantityStr) return 1;
    const lowerStr = quantityStr.toLowerCase();
    const num = parseInt(lowerStr, 10);
    if (!isNaN(num)) return num;
    return numberWordMap[lowerStr] || 1;
};

const handleStoreSelection = (lowerMessage, currentOrder) => {
  if (lowerMessage.includes('가게') && (lowerMessage.includes('어디') || lowerMessage.includes('어떤 가게'))) {
    const storeNames = stores.map(s => `${s.name} (${s.distance})`).join(', ');
    return { reply: `현재 ${storeNames} 등이 있습니다. 어느 가게를 이용하시겠어요?`, store: null, updatedOrder: currentOrder };
  }

  let targetStore = null;
  if (currentOrder.storeId) {
    targetStore = stores.find(s => s.id === currentOrder.storeId);
  } else {
    targetStore = stores.find(s => lowerMessage.includes(s.name.toLowerCase()));
    if (targetStore) {
      currentOrder.storeId = targetStore.id;
      currentOrder.storeName = targetStore.name;
      currentOrder.status = 'selecting_menu';
      const menuList = targetStore.menu.map(item => `${item.name} (${item.price}원)`).join(', ');
      return { reply: `${targetStore.name}을(를) 선택하셨습니다. 메뉴는 ${menuList} 입니다. 무엇을 주문하시겠어요?`, store: targetStore, updatedOrder: currentOrder };
    }
  }
  return { reply: null, store: targetStore, updatedOrder: currentOrder };
};

// --- Main Logic Function (상태를 인자로 받고, 새로운 상태를 반환) ---
const processMessage = (message, currentOrder) => {
  const lowerMessage = message.toLowerCase();
  let newOrder = JSON.parse(JSON.stringify(currentOrder));

  const storeSelectionResult = handleStoreSelection(lowerMessage, newOrder);
  if (storeSelectionResult.reply) {
    return { reply: storeSelectionResult.reply, newOrder: storeSelectionResult.updatedOrder };
  }
  let targetStore = storeSelectionResult.store;
  if (!targetStore && newOrder.storeId) {
    targetStore = stores.find(s => s.id === newOrder.storeId);
  }

  const handleMenuDisplay = (lowerMessage, targetStore) => {
    if (lowerMessage.includes('메뉴')) {
      if (targetStore) {
          const menuList = targetStore.menu.map(item => `${item.name} (${item.price}원)`).join(', ');
          return `${targetStore.name}의 메뉴는 ${menuList} 입니다. 무엇을 주문하시겠어요?`;
      }
      return '어떤 가게의 메뉴를 보고 싶으신가요?';
    }
    return null;
  };

  const menuDisplayReply = handleMenuDisplay(lowerMessage, targetStore);
  if (menuDisplayReply) {
    return { reply: menuDisplayReply, newOrder };
  }
  
  if (newOrder.status === 'pending' || newOrder.status === 'selecting_menu' || newOrder.status === 'ordered') {
    if (targetStore) {
      let replyMessage = '';
      let itemsAdded = false;
      const sortedMenu = [...targetStore.menu].sort((a, b) => b.name.length - a.name.length);
      let tempMessage = lowerMessage;

      sortedMenu.forEach(menuItem => {
        const numberWordsPattern = '한|하나|두|둘|세|셋|네|넷|다섯|여섯|일곱|여덟|아홉|열';
        const quantityPattern = `(?:\d+|${numberWordsPattern})`;
        const counterPattern = '(?:개|잔|병|그릇)?';
        const itemPattern = new RegExp(`(${quantityPattern})?\s*${menuItem.name}(?:\s+(${quantityPattern}))?${counterPattern}`, 'i');

        let matchFoundForThisItem = true;
        while (matchFoundForThisItem) {
          const match = tempMessage.match(itemPattern);
          if (match) {
            const quantityStr = match[1] || match[2];
            const quantity = parseQuantity(quantityStr);
            
            let itemOptions = [];
            menuItem.options.forEach(option => {
              if (lowerMessage.includes(option.name.toLowerCase())) {
                itemOptions.push(option);
              }
            });

            const existingItemIndex = newOrder.items.findIndex(item => item.itemId === menuItem.id && JSON.stringify(item.options) === JSON.stringify(itemOptions));
            if (existingItemIndex > -1) {
              newOrder.items[existingItemIndex].quantity += quantity;
            } else {
              newOrder.items.push({ ...menuItem, quantity, options: itemOptions });
            }
            itemsAdded = true;
            const optionsText = itemOptions.length > 0 ? ` (${itemOptions.map(o => o.name).join(', ')})` : '';
            replyMessage += `${menuItem.name}${optionsText} ${quantity}개, `;

            tempMessage = tempMessage.substring(0, match.index) + tempMessage.substring(match.index + match[0].length);
          } else {
            matchFoundForThisItem = false;
          }
        }
      });

      if (itemsAdded) {
        calculateTotalPrice(newOrder);
        newOrder.status = 'ordered';
        replyMessage = replyMessage.slice(0, -2);
        return { reply: `${replyMessage} 주문 목록에 추가했습니다. 현재 총 ${newOrder.totalPrice}원입니다. 더 주문하시겠어요? (주문 확인, 결제, 취소 가능)`, newOrder };
      }
    }
  }

  const handleOrderManagement = (lowerMessage, order) => {
    if (lowerMessage.includes('주문 확인') || lowerMessage.includes('내 주문')) {
      if (order.items.length === 0) return '현재 주문하신 내역이 없습니다.';
      const orderSummary = order.items.map(item => {
        const optionsText = item.options.length > 0 ? ` (${item.options.map(o => o.name).join(', ')})` : '';
        return `${item.name}${optionsText} ${item.quantity}개`;
      }).join(', ');
      return `현재 주문하신 내역은 ${orderSummary}이며, 총 ${order.totalPrice}원입니다. 더 주문하시겠어요? (결제, 취소 가능)`;
    }
    if (lowerMessage.includes('주문 취소')) {
      return '주문이 취소되었습니다. 무엇을 도와드릴까요?';
    }
    if (lowerMessage.includes('빼줘') || lowerMessage.includes('삭제')) {
      const itemToRemove = order.items.find(item => lowerMessage.includes(item.name.toLowerCase()));
      if (itemToRemove) {
        order.items = order.items.filter(item => item.itemId !== itemToRemove.itemId);
        calculateTotalPrice(order);
        return `${itemToRemove.name}을(를) 주문 목록에서 제외했습니다. 현재 총 ${order.totalPrice}원입니다. 더 주문하시겠어요?`;
      }
      return '어떤 항목을 빼드릴까요?';
    }
    return null;
  };

  const orderManagementReply = handleOrderManagement(lowerMessage, newOrder);
  if (orderManagementReply) {
    if (lowerMessage.includes('주문 취소')) {
        newOrder = getInitialOrderState(); // 상태 초기화
    }
    return { reply: orderManagementReply, newOrder };
  }

  const handlePaymentProcessing = (lowerMessage, order) => {
    if (lowerMessage.includes('결제') && order.status === 'ordered') {
      if (order.items.length === 0) return '주문하신 내역이 없어 결제를 진행할 수 없습니다.';
      order.status = 'payment_requested';
      return `총 ${order.totalPrice}원입니다. 어떤 방식으로 결제하시겠어요? (카드, 현금, 페이팔)`;
    }
    if (order.status === 'payment_requested') {
      const pickup = generatePickupTime();
      const paymentMethods = {
        '카드': '카드',
        '현금': '현금',
        '페이팔': '페이팔',
        'paypal': '페이팔'
      };
      const foundMethod = Object.keys(paymentMethods).find(m => lowerMessage.includes(m));
      if (foundMethod) {
        order.paymentMethod = paymentMethods[foundMethod];
        order.status = 'completed';
        order.pickupTime = pickup.timeString;
        order.pickupTimeDate = pickup.dateTime;
        if (order.paymentMethod === '페이팔') {
            const paymentLink = `https://your-dummy-paypal-link.com/pay?orderId=${Date.now()}`;
            return `페이팔 결제 링크를 생성했습니다: ${paymentLink}. 픽업 시간은 ${order.pickupTime}입니다.`;
        }
        return `${order.paymentMethod} 결제가 완료되었습니다. 픽업 시간은 ${order.pickupTime}입니다.`;
      }
    }
    return null;
  };

  const paymentProcessingReply = handlePaymentProcessing(lowerMessage, newOrder);
  if (paymentProcessingReply) {
    return { reply: paymentProcessingReply, newOrder };
  }

  const handleOrderStatusTracking = (lowerMessage, order) => {
    if (lowerMessage.includes('언제 나와') || lowerMessage.includes('픽업 시간')) {
      if (order.status === 'completed' && order.pickupTime) {
        return `주문하신 상품은 ${order.pickupTime}에 픽업 가능합니다.`;
      } else if (order.status === 'ordered' || order.status === 'payment_requested') {
        return '아직 결제가 완료되지 않았습니다. 결제를 먼저 진행해주세요.';
      }
      return '현재 진행 중인 주문이 없습니다. 무엇을 도와드릴까요?';
    }
    return null;
  };

  const orderStatusTrackingReply = handleOrderStatusTracking(lowerMessage, newOrder);
  if (orderStatusTrackingReply) {
    return { reply: orderStatusTrackingReply, newOrder };
  }

  if (newOrder.status === 'pending') {
    return { reply: '안녕하세요! AI 키오스크입니다. 무엇을 도와드릴까요? (예: 근처 가게, 메뉴 보여줘)', newOrder };
  }

  return { reply: '죄송합니다. 잘 이해하지 못했어요. 다시 말씀해주시겠어요?', newOrder };
};

// Vercel Serverless Function Handler
module.exports = (req, res) => {
  // We only want to handle POST requests
  if (req.method === 'POST') {
    // The logic from the old app.post() goes here
    const { message, currentState } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 프론트에서 받은 상태를 사용하거나, 없다면 초기 상태를 사용합니다.
    const orderState = currentState || getInitialOrderState();

    const { reply, newOrder } = processMessage(message, orderState);
    
    // 처리 후의 새로운 상태를 프론트엔드로 다시 보내줍니다.
    res.status(200).json({ reply, currentOrder: newOrder });

  } else {
    // Handle any other HTTP method
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};
