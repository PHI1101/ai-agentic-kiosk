# Next Steps for VoiceOrder AI Kiosk Project

This document summarizes the work completed so far and outlines areas for future improvement and development.

## Work Completed

1.  **Frontend Build Error (TS18046) Fix**: Resolved a TypeScript error in `MainPage.tsx` related to accessing `error.response` without proper type checking.
2.  **Backend 500 Internal Server Error Fix**: Corrected a `NameError` in `ChatWithAIView` (`actual_intent` vs `intent`) that caused server-side crashes.
3.  **Missing Burger Data Integration**: Added a new Django migration (`0007_add_momstouch.py`) to seed "Mom's Touch" store and burger menu items into the database.
4.  **Improved NLU Logic**: Refined the `simple_nlu` function in `views.py` by removing premature `order_food` intent detection, allowing the AI to handle item ordering more flexibly based on context.
5.  **Frontend UI & Voice/TTS Functionality Refinement**: 
    *   Reverted `ChatInterface.tsx` and `MainPage.tsx` to the previous UI layout based on user preference, moving input controls back to `MainPage.tsx`.
    *   Ensured Text-to-Speech (TTS) functionality for assistant messages is correctly handled within `ChatInterface.tsx`.
    *   Modified voice recognition to be user-initiated via a microphone button, removing automatic start on component mount for better user control and browser permission handling.
6.  **Enhanced Ordering Logic (Price & Store Ambiguity)**:
    *   Modified the `_update_order` helper function in `views.py` to accept `store_name` as an argument, enabling unique identification of `MenuItem` objects even if names are duplicated across stores.
    *   Updated the AI system prompt to strictly instruct the AI to include `store_name` in the `add_to_cart` JSON action and to ask for clarification if a menu item is ambiguous (exists in multiple stores).
    *   Adjusted the JSON parsing logic in `ChatWithAIView` to correctly extract and utilize the `store_name` for accurate order processing.
7.  **Backend Performance & Frontend Rendering Error Fixes**:
    *   Optimized `db_search_result` generation in `views.py` to perform database filtering efficiently, addressing `499` (Client Closed Request) errors caused by long backend processing times.
    *   Temporarily switched the OpenAI model from `gpt-4o` to `gpt-3.5-turbo` to evaluate and mitigate latency issues.
    *   Implemented `processedTranscriptRef` in `MainPage.tsx` to ensure each unique voice `transcript` is processed only once, resolving "too many re-renders" (`Minified React error #185`) in the frontend.
8.  **Robust AI Response JSON Parsing**: Enhanced the backend's JSON parsing logic to gracefully handle cases where the AI might output raw JSON directly (without the ````json\n...\n```` wrapper), ensuring `add_to_cart` actions are still processed correctly.
9.  **Order Finalization Logic Implementation**: Implemented the `finalize_order` intent in `ChatWithAIView` to mark the current order as 'completed' in the database and clear the frontend cart, providing a functional "주문확정" (Order Confirmation) feature.
10. **Cart Clear Error Fix**: Resolved a `TypeError` in `OrderSummary.tsx` by making the `useOrderStore.setOrder` function robust to empty `currentOrder` objects, ensuring the cart clears correctly after order finalization.

## Future Improvements and Enhancements

1.  **Full Order Finalization Workflow**:
    *   **Payment Integration**: Implement actual payment processing (e.g., simulated payment gateway integration).
    *   **Order Management**: Integrate with a kitchen display system (KDS) or a more comprehensive order management system.
    *   **Order Tracking**: Provide a unique order number to the user for tracking.
2.  **Advanced Ordering Options**:
    *   **Quantity Specification**: Allow users to specify item quantities (e.g., "불고기버거 2개 주세요"). This will require updates to NLU and AI prompt instructions.
    *   **Order Modification**: Implement functionality for users to remove specific items from the cart or modify quantities before finalization.
    *   **Order Cancellation**: Allow users to cancel an entire order.
3.  **Enhanced User Experience**:
    *   **Store Selection Guidance**: Improve the AI's guidance when multiple stores offer the same item, offering a more guided selection process (e.g., "A점에서 드릴까요, B점에서 드릴까요?").
    *   **AI Model Optimization**: Re-evaluate the performance and cost-effectiveness of `gpt-4o` versus `gpt-3.5-turbo` after all system optimizations. Consider implementing dynamic model selection based on query complexity or user preferences.
    *   **Improved Error Feedback**: Provide more specific and user-friendly error messages on the frontend for various backend failures.
    *   **Visual Feedback for Voice Status**: Implement clearer visual cues for voice recognition status (e.g., "듣고 있어요...", "생각 중...").
    *   **Accessibility**: Continue to prioritize and implement barrier-free accessibility features for visually, hearing, and physically impaired users, including AI voice guidance and visual guidance.
    *   **UI/UX Polish**: Further refine the overall chat interface, order summary display, and AI avatar animations for a more polished user experience.
4.  **System Robustness & Maintainability**:
    *   **Deployment Automation**: Streamline the deployment process, especially for database migrations on platforms like Railway (e.g., using Railway's build hooks or custom deployment scripts).
    *   **Comprehensive Testing**: Develop a more extensive suite of unit and integration tests for both frontend and backend components.
    *   **Code Documentation**: Enhance inline code comments and overall project documentation.
    *   **Frontend Build Tooling Issue**: The `replace` tool in the development environment consistently fails to perform multi-line string replacements in `MainPage.tsx`, necessitating a manual `read_file` and `write_file` approach for certain code modifications. Investigate and resolve this tool limitation.