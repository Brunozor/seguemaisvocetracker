useEffect(() => {
  const processPageLoad = async () => {
    try {
      console.log("[INDEX] Processando carregamento da página");
      console.log("[INDEX] URL completa acessada:", window.location.href);

      // Espera pixel inicial
      await new Promise(resolve => setTimeout(resolve, 200));

      // Pega UTM
      const utmParams = UtmService.getUtmParamsFromUrl();

      // Dados de IP e geolocalização
      const { ip, geoData } = await UtmService.getIpAndGeoData();

      // Dados do dispositivo
      const deviceData = {
        device_type: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        operating_system: navigator.platform || 'unknown',
        browser: navigator.userAgent.split(' ').pop() || 'unknown',
        screen_resolution: `${screen.width}x${screen.height}`
      };

      // fbclid e cookie
      const urlParams = new URLSearchParams(window.location.search);
      const fbclid = urlParams.get('fbclid');
      let fbc: string | null = null;
      if (fbclid) fbc = await UtmService.waitForFbcCookie();

      // Número fixo WhatsApp
      const numeroData = {
        telefone: "5591982581297",
        mensagem: "Olá! Tenho interesse. Sou o cliente XXX me manda as promoções por gentileza!!"
      };

      // 🔑 Chama o backend para salvar os dados e pegar o client_code real
      const savedRecord = await UtmService.saveEnhancedUtmData({
        utmParams,
        ip,
        geoData: { ...geoData, pagina: window.location.href, user_agent: navigator.userAgent },
        deviceData,
        fbclid,
        fbc,
        numeroRedirecionado: numeroData?.telefone,
        external_id: fbp,
        event_id: eventId
      });

      // Aqui tá o client_code confiável do banco
      const clientCode = savedRecord?.client_code ?? savedRecord?.clientCode;
      if (!clientCode) throw new Error("client_code não retornado pelo backend");

      // Dispara Lead no Pixel
      setTimeout(() => {
        const leadEventId = trackLead({
          content_name: window.location.pathname,
          content_category: utmParams?.utm_campaign || 'direct'
        });
        console.log("[INDEX] Evento Lead:", leadEventId);
      }, 500);

      // Mostra toast
      toast({
        title: "Segue Mais Você",
        description: `Seu código: ${clientCode.toString().padStart(3,'0')}`
      });

      // Redireciona para WhatsApp com o client_code real
      if (numeroData) {
        const message = UtmService.formatWhatsAppMessage(clientCode, ip, numeroData.mensagem);
        const whatsappUrl = UtmService.generateWhatsAppUrl(numeroData.telefone, message);
        console.log("[INDEX] Redirecionando pra WhatsApp:", whatsappUrl);
        setTimeout(() => { window.location.href = whatsappUrl; }, 1000);
      }

    } catch (err: any) {
      console.error("[INDEX] Erro:", err);
      setError(err.message || "Ocorreu um erro. Redirecionando alternativo...");
      setTimeout(() => {
        const defaultPhone = "5591982581297";
        const defaultMsg = "Olá! Tenho interesse. Me envia promoções, por favor!";
        const altUrl = `https://api.whatsapp.com/send/?phone=${defaultPhone}&text=${encodeURIComponent(defaultMsg)}&type=phone_number&app_absent=0`;
        window.location.href = altUrl;
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitialized) processPageLoad();
}, [isInitialized, fbp, eventId, trackLead]);
