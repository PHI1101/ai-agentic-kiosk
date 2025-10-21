const express = require('express');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// --- Mock 데이터베이스 ---
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

let currentOrder = {
  storeId: null,
  storeName: null,
  items: [], // { itemId: number, name: string, quantity: number, options: [] }
  totalPrice: 0,
  status: 'pending', // pending -> selecting_store -> selecting_menu -> ordered -> payment_requested -> completed -> cancelled
  paymentMethod: null,
  pickupTime: null,
  pickupTimeDate: null, // Date 객체 추가
};

// --------------------

const resetOrder = () => {
  currentOrder = {
    storeId: null,
    storeName: null,
    items: [],
    totalPrice: 0,
    status: 'pending',
    paymentMethod: null,
    pickupTime: null,
    pickupTimeDate: null,
  };
};

const calculateTotalPrice = () => {
  let total = 0;
  currentOrder.items.forEach(item => {
    let itemPrice = item.price * item.quantity;
    item.options.forEach(option => {
      itemPrice += option.price;
    });
    total += itemPrice;
  });
  currentOrder.totalPrice = total;
};

const generatePickupTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15); // 15분 후 픽업
  return { timeString: `${now.getHours()}시 ${now.getMinutes()}분`, dateTime: now.toISOString() }; // ISO string으로 변환
};

const numberWordMap = {
    '한': 1, '하나': 1,
    '두': 2, '둘': 2,
    '세': 3, '셋': 3,
    '네': 4, '넷': 4,
    '다섯': 5,
    '여섯': 6,
    '일곱': 7,
    '여덟': 8,
    '아홉': 9,
    '열': 10,
};

const parseQuantity = (quantityStr) => {
    if (!quantityStr) return 1;
    const lowerStr = quantityStr.toLowerCase();
    const num = parseInt(lowerStr, 10);
    if (!isNaN(num)) {
        return num;
    }
    return numberWordMap[lowerStr] || 1;
};

const handleStoreSelection = (lowerMessage) => {
  // 1. 동적 메뉴 및 가게 정보 관리 (Feature 1)
  if (lowerMessage.includes('가게') && (lowerMessage.includes('어디') || lowerMessage.includes('어떤 가게'))) {
    const storeNames = stores.map(s => `${s.name} (${s.distance})`).join(', ');
    return { reply: `현재 ${storeNames} 등이 있습니다. 어느 가게를 이용하시겠어요?`, store: null };
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
      return { reply: `${targetStore.name}을(를) 선택하셨습니다. 메뉴는 ${menuList} 입니다. 무엇을 주문하시겠어요?`, store: targetStore };
    }
  }
  return { reply: null, store: targetStore };
};

// 사용자의 메시지를 분석하고 상태를 관리하는 함수
const processMessage = (message) => {
  const lowerMessage = message.toLowerCase();

  const storeSelectionResult = handleStoreSelection(lowerMessage);
  if (storeSelectionResult.reply) {
    return storeSelectionResult.reply;
  }
  // If a store was just selected, use it. Otherwise, try to find it from currentOrder.storeId
  let targetStore = storeSelectionResult.store;
  if (!targetStore && currentOrder.storeId) {
    targetStore = stores.find(s => s.id === currentOrder.storeId);
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
    return menuDisplayReply;
  }

  // 2. 주문 수량 및 옵션 지정 (Feature 2) & 주문 시작
  if (currentOrder.status === 'pending' || currentOrder.status === 'selecting_menu' || currentOrder.status === 'ordered') {
    if (targetStore) {
      let replyMessage = '';
      let itemsAdded = false;

      // 메시지에서 모든 메뉴 항목과 수량을 찾기 (새로운 로직)
      const menuItemsInMessage = [];
      let tempMessage = lowerMessage; // 메시지를 수정 가능한 임시 변수에 저장

      // 메뉴 이름 길이에 따라 정렬하여 긴 이름이 먼저 매칭되도록 함 (예: "치즈돈까스"가 "돈까스"보다 먼저)
      const sortedMenu = [...targetStore.menu].sort((a, b) => b.name.length - a.name.length);

      sortedMenu.forEach(menuItem => {
        const numberWordsPattern = '한|하나|두|둘|세|셋|네|넷|다섯|여섯|일곱|여덟|아홉|열';
        const quantityPattern = `(?:\d+|${numberWordsPattern})`;
        const counterPattern = '(?:개|잔|병|그릇)?';
        
        // 메뉴 이름 앞뒤에 수량이 올 수 있는 패턴
        // 'i' 플래그만 사용하고 'g' 플래그는 사용하지 않음 (match.index를 활용하여 replace)
        const itemPattern = new RegExp(`(${quantityPattern})?\s*${menuItem.name}(?:\s+(${quantityPattern}))?${counterPattern}`, 'i');

        let matchFoundForThisItem = true;
        while (matchFoundForThisItem) {
          const match = tempMessage.match(itemPattern); // tempMessage에서 첫 번째 매치만 찾음

          if (match) {
            const quantityStr = match[1] || match[2];
            const quantity = parseQuantity(quantityStr);
            menuItemsInMessage.push({ menuItem, quantity });

            // 매치된 부분을 tempMessage에서 제거하여 다음 검색에 영향을 주지 않도록 함
            // match.index와 match[0].length를 사용하여 정확히 매치된 부분만 제거
            tempMessage = tempMessage.substring(0, match.index) + tempMessage.substring(match.index + match[0].length);
          } else {
            matchFoundForThisItem = false; // 더 이상 매치되는 것이 없으면 루프 종료
          }
        }
      });

      if (menuItemsInMessage.length > 0) {
        menuItemsInMessage.forEach(({ menuItem, quantity }) => {
          let itemOptions = [];
          menuItem.options.forEach(option => {
            if (lowerMessage.includes(option.name.toLowerCase())) {
              itemOptions.push(option);
            }
          });

          const existingItemIndex = currentOrder.items.findIndex(item => item.itemId === menuItem.id && JSON.stringify(item.options) === JSON.stringify(itemOptions));

          if (existingItemIndex > -1) {
            currentOrder.items[existingItemIndex].quantity += quantity;
          } else {
            currentOrder.items.push({ ...menuItem, quantity, options: itemOptions });
          }
          itemsAdded = true;
          const optionsText = itemOptions.length > 0 ? ` (${itemOptions.map(o => o.name).join(', ')})` : '';
          replyMessage += `${menuItem.name}${optionsText} ${quantity}개, `;
        });
      }

      if (itemsAdded) {
        calculateTotalPrice();
        currentOrder.status = 'ordered';
        replyMessage = replyMessage.slice(0, -2); // 마지막 콤마 제거
        return `${replyMessage} 주문 목록에 추가했습니다. 현재 총 ${currentOrder.totalPrice}원입니다. 더 주문하시겠어요? (주문 확인, 결제, 취소 가능)`;
      }
    }
  }

  const handleOrderManagement = (lowerMessage) => {
    // 3. 주문 확인 및 수정/취소 (Feature 3)
    if (lowerMessage.includes('주문 확인') || lowerMessage.includes('내 주문')) {
      if (currentOrder.items.length === 0) {
        return '현재 주문하신 내역이 없습니다.';
      }
      const orderSummary = currentOrder.items.map(item => {
        const optionsText = item.options.length > 0 ? ` (${item.options.map(o => o.name).join(', ')})` : '';
        return `${item.name}${optionsText} ${item.quantity}개`;
      }).join(', ');
      return `현재 주문하신 내역은 ${orderSummary}이며, 총 ${currentOrder.totalPrice}원입니다. 더 주문하시겠어요? (결제, 취소 가능)`;
    }

    if (lowerMessage.includes('주문 취소')) {
      resetOrder();
      return '주문이 취소되었습니다. 무엇을 도와드릴까요?';
    }

    if (lowerMessage.includes('빼줘') || lowerMessage.includes('삭제')) {
      const itemToRemove = currentOrder.items.find(item => lowerMessage.includes(item.name.toLowerCase()));
      if (itemToRemove) {
        currentOrder.items = currentOrder.items.filter(item => item.itemId !== itemToRemove.itemId);
        calculateTotalPrice();
        return `${itemToRemove.name}을(를) 주문 목록에서 제외했습니다. 현재 총 ${currentOrder.totalPrice}원입니다. 더 주문하시겠어요?`;
      }
      return '어떤 항목을 빼드릴까요?';
    }
    return null;
  };

  const orderManagementReply = handleOrderManagement(lowerMessage);
  if (orderManagementReply) {
    return orderManagementReply;
  }

  const handlePaymentProcessing = (lowerMessage) => {
    // 4. 결제 방식 선택 (Feature 4)
    if (lowerMessage.includes('결제') && currentOrder.status === 'ordered') {
      if (currentOrder.items.length === 0) {
          return '주문하신 내역이 없어 결제를 진행할 수 없습니다.';
      }
      currentOrder.status = 'payment_requested';
      return `총 ${currentOrder.totalPrice}원입니다. 어떤 방식으로 결제하시겠어요? (카드, 현금, 페이팔)`;
    }

    if (currentOrder.status === 'payment_requested') {
      const pickup = generatePickupTime();
      if (lowerMessage.includes('카드')) {
        currentOrder.paymentMethod = '카드';
        currentOrder.status = 'completed';
        currentOrder.pickupTime = pickup.timeString;
        currentOrder.pickupTimeDate = pickup.dateTime;
        const reply = `카드 결제가 완료되었습니다. 픽업 시간은 ${currentOrder.pickupTime}입니다.`;
        // resetOrder(); // 결제 후 바로 초기화하지 않음
        return reply;
      } else if (lowerMessage.includes('현금')) {
        currentOrder.paymentMethod = '현금';
        currentOrder.status = 'completed';
        currentOrder.pickupTime = pickup.timeString;
        currentOrder.pickupTimeDate = pickup.dateTime;
        const reply = `현금 결제가 완료되었습니다. 픽업 시간은 ${currentOrder.pickupTime}입니다.`;
        // resetOrder(); // 결제 후 바로 초기화하지 않음
        return reply;
      } else if (lowerMessage.includes('페이팔') || lowerMessage.includes('paypal')) {
        currentOrder.paymentMethod = '페이팔';
        currentOrder.status = 'completed';
        currentOrder.pickupTime = pickup.timeString;
        currentOrder.pickupTimeDate = pickup.dateTime;
        const paymentLink = `https://your-dummy-paypal-link.com/pay?orderId=${Date.now()}`;
        const reply = `페이팔 결제 링크를 생성했습니다: ${paymentLink}. 픽업 시간은 ${currentOrder.pickupTime}입니다.`;
        // resetOrder(); // 결제 후 바로 초기화하지 않음
        return reply;
      }
    }
    return null;
  };

  const paymentProcessingReply = handlePaymentProcessing(lowerMessage);
  if (paymentProcessingReply) {
    return paymentProcessingReply;
  }

  const handleOrderStatusTracking = (lowerMessage) => {
    // 5. 주문 상태 추적 (Feature 5)
    if (lowerMessage.includes('언제 나와') || lowerMessage.includes('픽업 시간')) {
      if (currentOrder.status === 'completed' && currentOrder.pickupTime) {
        return `주문하신 상품은 ${currentOrder.pickupTime}에 픽업 가능합니다.`;
      } else if (currentOrder.status === 'ordered' || currentOrder.status === 'payment_requested') {
        return '아직 결제가 완료되지 않았습니다. 결제를 먼저 진행해주세요.';
      }
      return '현재 진행 중인 주문이 없습니다. 무엇을 도와드릴까요?';
    }
    return null;
  };

  const orderStatusTrackingReply = handleOrderStatusTracking(lowerMessage);
  if (orderStatusTrackingReply) {
    return orderStatusTrackingReply;
  }

  const handleDefaultResponse = (currentOrderStatus) => {
    // 초기 상태 또는 이해하지 못한 경우
    if (currentOrderStatus === 'pending') {
      return '안녕하세요! AI 키오스크입니다. 무엇을 도와드릴까요? (예: 근처 가게, 메뉴 보여줘)';
    }
    return '죄송합니다. 잘 이해하지 못했어요. 다시 말씀해주시겠어요?';
  };

  return handleDefaultResponse(currentOrder.status);
};


app.post('/api/process-command', (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const reply = processMessage(message.toLowerCase());
  
  res.json({ reply, currentOrder });
});

app.listen(port, () => {
  console.log(`Mock API server listening at http://localhost:${port}`);
});
