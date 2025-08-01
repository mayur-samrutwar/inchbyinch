export default function TestEnv() {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Environment Variables Test</h1>
      <pre>
        {JSON.stringify({
          NEXT_PUBLIC_BASE_SEPOLIA_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_FACTORY_ADDRESS,
          NEXT_PUBLIC_BASE_SEPOLIA_ORDER_MANAGER_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORDER_MANAGER_ADDRESS,
          NEXT_PUBLIC_BASE_SEPOLIA_ORACLE_ADAPTER_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ORACLE_ADAPTER_ADDRESS,
          NEXT_PUBLIC_BASE_SEPOLIA_LOP_ADAPTER_ADDRESS: process.env.NEXT_PUBLIC_BASE_SEPOLIA_LOP_ADAPTER_ADDRESS,
        }, null, 2)}
      </pre>
    </div>
  );
} 