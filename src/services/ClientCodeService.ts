
import { supabase } from "../integrations/supabase/client";
import CacheService from "./CacheService";

export class ClientCodeService {
  public async generateClientCode(): Promise<number> {
    try {
      console.log("[ClientCode] Iniciando geração otimizada do client_code...");

      // Check cache for recent codes
      const cachedCodes = CacheService.get<number[]>('recent_client_codes');
      
      if (cachedCodes && cachedCodes.length > 0) {
        console.log("[ClientCode] Using cached recent codes:", cachedCodes);
        const nextCode = this.calculateNextCode(cachedCodes);
        
        // Update cache with new code
        const updatedCodes = [nextCode, ...cachedCodes.slice(0, 9)];
        CacheService.set('recent_client_codes', updatedCodes, 10); // 10 minutes cache
        
        return nextCode;
      }

      // Buscar os últimos 10 códigos ordenados por timestamp
      const { data: recentCodes, error } = await supabase
        .from('utm')
        .select('client_code, timestamp')
        .not('client_code', 'is', null)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error) {
        console.error("[ClientCode] Erro ao buscar códigos recentes:", error);
        return this.getContingencyCode();
      }

      if (!recentCodes || recentCodes.length === 0) {
        console.log("[ClientCode] Nenhum código encontrado, iniciando com 1");
        CacheService.set('recent_client_codes', [1], 10);
        return 1;
      }

      console.log("[ClientCode] Códigos recentes encontrados:", recentCodes.map(r => r.client_code));

      // Extrair apenas os códigos e remover nulls
      const codes = recentCodes
        .map(record => record.client_code)
        .filter(code => code !== null) as number[];

      if (codes.length === 0) {
        console.log("[ClientCode] Nenhum código válido encontrado, iniciando com 1");
        CacheService.set('recent_client_codes', [1], 10);
        return 1;
      }

      const nextCode = this.calculateNextCode(codes);
      
      // Cache the codes for faster subsequent lookups
      CacheService.set('recent_client_codes', codes, 10);

      console.log("[ClientCode] Código gerado:", nextCode);
      return nextCode;

    } catch (error) {
      console.error("[ClientCode] Erro na geração do client_code:", error);
      return this.getContingencyCode();
    }
  }

  private calculateNextCode(codes: number[]): number {
    // Encontrar o maior código atual
    const maxCode = Math.max(...codes);
    console.log("[ClientCode] Maior código encontrado:", maxCode);

    // Calcular próximo código
    let nextCode = maxCode + 1;

    // Se ultrapassar 999, voltar para 1
    if (nextCode > 999) {
      nextCode = 1;
      console.log("[ClientCode] Resetando para 1 (passou de 999)");
    }

    // Verificar se o próximo código já existe nos últimos códigos (contingência)
    if (codes.includes(nextCode)) {
      console.warn("[ClientCode] Código", nextCode, "já existe, buscando próximo disponível");
      nextCode = this.findNextAvailableCode(codes, nextCode);
    }

    return nextCode;
  }

  private findNextAvailableCode(recentCodes: number[], startFrom: number): number {
    let candidate = startFrom;
    let attempts = 0;
    const maxAttempts = 999; // Evitar loop infinito

    while (attempts < maxAttempts) {
      if (!recentCodes.includes(candidate)) {
        console.log("[ClientCode] Código disponível encontrado:", candidate);
        return candidate;
      }

      candidate++;
      if (candidate > 999) {
        candidate = 1; // Volta para 1 se passar de 999
      }

      attempts++;

      // Se voltou ao ponto inicial, sair do loop
      if (candidate === startFrom && attempts > 1) {
        break;
      }
    }

    // Se não encontrou nenhum disponível, usar contingência
    console.warn("[ClientCode] Não foi possível encontrar código disponível, usando contingência");
    return this.getContingencyCode();
  }

  private getContingencyCode(): number {
    // Código de contingência baseado em timestamp + random
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 100);
    const contingencyCode = parseInt(timestamp.toString().slice(-2) + random.toString().padStart(2, '0').slice(-1));
    
    // Garantir que está entre 1 e 999
    const finalCode = (contingencyCode % 999) + 1;
    console.log("[ClientCode] Código de contingência gerado:", finalCode);
    return finalCode;
  }
}

export default new ClientCodeService();
