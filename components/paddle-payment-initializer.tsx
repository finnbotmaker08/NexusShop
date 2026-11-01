"use client";

import Script from "next/script";
import { useState } from "react";

type PaddleApi = {
  Environment: {
    set(environment: "sandbox"): void;
  };
  Initialize(options: {
    token: string;
    checkout: {
      settings: {
        successUrl: string;
        theme: "dark";
        locale: "en";
      };
    };
  }): void;
};

declare global {
  interface Window {
    Paddle?: PaddleApi;
  }
}

export function PaddlePaymentInitializer({
  clientToken,
  environment,
}: {
  clientToken: string;
  environment: "sandbox" | "production";
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  return (
    <>
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={() => {
          if (!window.Paddle) {
            setStatus("error");
            return;
          }
          if (environment === "sandbox") {
            window.Paddle.Environment.set("sandbox");
          }

          const successUrl = new URL("/account?checkout=success", window.location.origin);
          window.Paddle.Initialize({
            token: clientToken,
            checkout: {
              settings: {
                successUrl: successUrl.href,
                theme: "dark",
                locale: "en",
              },
            },
          });
          setStatus("ready");
        }}
        onError={() => setStatus("error")}
      />
      <p role={status === "error" ? "alert" : "status"} className="mt-6 text-xs text-white/45">
        {status === "loading"
          ? "Loading the secure payment checkout..."
          : status === "error"
            ? "The secure checkout could not be loaded. Return to your order and try again."
            : "Your secure Paddle checkout is opening."}
      </p>
    </>
  );
}
