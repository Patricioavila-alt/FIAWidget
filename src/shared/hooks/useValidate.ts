// ============================================================
// useValidate — hook para validar recetas médicas
//
// Uso:
//   const { validate, isValidating, result, abort } = useValidate();
//
//   await validate({
//     input_mode: 'image',
//     image_b64:  base64,
//     cart:       { Amoxicilina: 21 },
//   });
// ============================================================

import { useCallback, useRef, useState } from 'react';
import { validatePrescription } from '@/shared/services/agentService';
import type { ValidateRequest, ValidateNode, ValidateVerdict } from '@/shared/services/agentService';

export interface ValidateResult {
  verdict:          ValidateVerdict;
  validationToken?: string;
  nodes:            ValidateNode[];
  error?:           string;
}

export function useValidate() {
  const [isValidating, setIsValidating] = useState(false);
  const [result,       setResult]       = useState<ValidateResult | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const validate = useCallback(async (request: ValidateRequest) => {
    setIsValidating(true);
    setResult(null);

    const nodes: ValidateNode[] = [];

    const abort = await validatePrescription(request, {
      onNode: (node) => {
        nodes.push(node);
      },
      onDone: (verdict, token) => {
        setIsValidating(false);
        setResult({ verdict, validationToken: token, nodes });
      },
      onError: (message) => {
        setIsValidating(false);
        setResult({ verdict: '', nodes, error: message });
      },
    });

    abortRef.current = abort;
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.();
    setIsValidating(false);
  }, []);

  return { validate, isValidating, result, abort };
}
