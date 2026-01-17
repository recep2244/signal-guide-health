import { useCallback, useReducer } from "react";
import {
  FlowType,
  FlowStep,
  FLOW_REGISTRY,
  MAIN_FLOW,
  getFlowTypeForOption,
  isQuickAction,
  isUrgentSymptom,
  isConcernSymptom,
} from "@/config/flows";
import { AGENT_TYPING_DELAY_MS, FLOW_STEP_DELAY_MS } from "@/config/constants";

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  id: string;
  role: "patient" | "agent";
  content: string;
  timestamp: Date;
  options?: string[];
}

interface FlowState {
  messages: ChatMessage[];
  currentStep: number;
  flowType: FlowType;
  isTyping: boolean;
  demoStarted: boolean;
}

type FlowAction =
  | { type: "START_DEMO" }
  | { type: "RESET_DEMO" }
  | { type: "SET_TYPING"; payload: boolean }
  | { type: "ADD_PATIENT_MESSAGE"; payload: string }
  | { type: "ADD_AGENT_MESSAGE"; payload: { content: string; options?: string[] } }
  | { type: "CHANGE_FLOW"; payload: { flowType: FlowType; step?: number } }
  | { type: "INCREMENT_STEP" };

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: FlowState = {
  messages: [],
  currentStep: 0,
  flowType: "normal",
  isTyping: false,
  demoStarted: false,
};

// ============================================================================
// REDUCER
// ============================================================================

function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "START_DEMO":
      return {
        ...state,
        demoStarted: true,
        flowType: "normal",
        currentStep: 0,
        messages: [],
      };

    case "RESET_DEMO":
      return initialState;

    case "SET_TYPING":
      return { ...state, isTyping: action.payload };

    case "ADD_PATIENT_MESSAGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: `patient-${Date.now()}`,
            role: "patient",
            content: action.payload,
            timestamp: new Date(),
          },
        ],
      };

    case "ADD_AGENT_MESSAGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: `agent-${Date.now()}`,
            role: "agent",
            content: action.payload.content,
            timestamp: new Date(),
            options: action.payload.options,
          },
        ],
        isTyping: false,
      };

    case "CHANGE_FLOW":
      return {
        ...state,
        flowType: action.payload.flowType,
        currentStep: action.payload.step ?? 0,
      };

    case "INCREMENT_STEP":
      return { ...state, currentStep: state.currentStep + 1 };

    default:
      return state;
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function usePatientFlow() {
  const [state, dispatch] = useReducer(flowReducer, initialState);

  const getCurrentFlow = useCallback((): FlowStep[] => {
    return FLOW_REGISTRY[state.flowType];
  }, [state.flowType]);

  const addAgentMessage = useCallback(
    (content: string, options?: string[]) => {
      dispatch({ type: "SET_TYPING", payload: true });
      setTimeout(() => {
        dispatch({ type: "ADD_AGENT_MESSAGE", payload: { content, options } });
      }, AGENT_TYPING_DELAY_MS);
    },
    []
  );

  const startDemo = useCallback(() => {
    dispatch({ type: "START_DEMO" });
    const firstMessage = MAIN_FLOW[0];
    setTimeout(() => {
      addAgentMessage(firstMessage.content, firstMessage.options);
    }, 100);
  }, [addAgentMessage]);

  const resetDemo = useCallback(() => {
    dispatch({ type: "RESET_DEMO" });
  }, []);

  const switchFlow = useCallback(
    (flowType: FlowType, step: number = 0) => {
      dispatch({ type: "CHANGE_FLOW", payload: { flowType, step } });
      const flow = FLOW_REGISTRY[flowType];
      if (flow[step]) {
        setTimeout(() => {
          addAgentMessage(flow[step].content, flow[step].options);
        }, FLOW_STEP_DELAY_MS);
      }
    },
    [addAgentMessage]
  );

  const handleOptionSelect = useCallback(
    (option: string) => {
      // Add patient message
      dispatch({ type: "ADD_PATIENT_MESSAGE", payload: option });

      // Check for quick action flows (except "Continue check-in")
      if (isQuickAction(option) && option !== "Continue check-in") {
        const flowType = getFlowTypeForOption(option);
        if (flowType) {
          switchFlow(flowType);
          return;
        }
      }

      // Handle "Continue check-in" from first step
      if (state.flowType === "normal" && state.currentStep === 0) {
        if (option === "Continue check-in") {
          dispatch({ type: "CHANGE_FLOW", payload: { flowType: "normal", step: 1 } });
          setTimeout(() => {
            addAgentMessage(MAIN_FLOW[1].content, MAIN_FLOW[1].options);
          }, FLOW_STEP_DELAY_MS);
          return;
        }
      }

      // Handle urgent symptoms check (step 2 in normal flow)
      if (state.flowType === "normal" && state.currentStep === 2) {
        if (isUrgentSymptom(option)) {
          switchFlow("urgent");
          return;
        } else if (isConcernSymptom(option)) {
          switchFlow("concern");
          return;
        }
      }

      // Handle sync issue report
      if (
        state.flowType === "normal" &&
        state.currentStep === 3 &&
        option === "Report sync issue"
      ) {
        setTimeout(() => {
          addAgentMessage(
            "Thanks for flagging that. I've logged a device sync issue and notified support. We'll still continue your check-in."
          );
        }, 400);
        dispatch({ type: "CHANGE_FLOW", payload: { flowType: "normal", step: 4 } });
        setTimeout(() => {
          addAgentMessage(MAIN_FLOW[4].content, MAIN_FLOW[4].options);
        }, 1200);
        return;
      }

      // Handle medication-related options
      if (state.flowType === "normal" && state.currentStep === 5) {
        const flowType = getFlowTypeForOption(option);
        if (flowType) {
          switchFlow(flowType);
          return;
        }
      }

      // Progress through current flow
      const flow = getCurrentFlow();
      const nextStep = state.currentStep + 1;

      if (nextStep < flow.length) {
        dispatch({ type: "INCREMENT_STEP" });
        setTimeout(() => {
          const nextMessage = flow[nextStep];
          addAgentMessage(nextMessage.content, nextMessage.options);
        }, FLOW_STEP_DELAY_MS);
      }
    },
    [
      state.flowType,
      state.currentStep,
      getCurrentFlow,
      addAgentMessage,
      switchFlow,
    ]
  );

  const handleFreeTextInput = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      dispatch({ type: "ADD_PATIENT_MESSAGE", payload: text });

      setTimeout(() => {
        addAgentMessage(
          "Thank you for sharing that. I've noted this for your care team. Is there anything else you'd like to tell me?",
          ["No, that's everything", "Yes, one more thing"]
        );
      }, FLOW_STEP_DELAY_MS);
    },
    [addAgentMessage]
  );

  return {
    // State
    messages: state.messages,
    currentStep: state.currentStep,
    flowType: state.flowType,
    isTyping: state.isTyping,
    demoStarted: state.demoStarted,

    // Actions
    startDemo,
    resetDemo,
    handleOptionSelect,
    handleFreeTextInput,
    getCurrentFlow,
  };
}
