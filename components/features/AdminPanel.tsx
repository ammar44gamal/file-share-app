'use client';

export default function AdminPanel({ adminUserList }: { adminUserList: any[] }) {
    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#080808] border border-[#222] rounded-xl overflow-x-auto shadow-2xl">
                <table className="w-full text-left text-xs text-white min-w-[600px]">
                    <thead className="bg-[#111] text-[#444] uppercase tracking-widest font-bold border-b border-[#222]">
                        <tr>
                            <th className="p-4">Identity</th>
                            <th className="p-4">Email Channel</th>
                            <th className="p-4">Joined</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                        {adminUserList.map(u => (
                            <tr key={u.id} className="hover:bg-[#111] transition duration-300">
                                <td className="p-4 font-bold">{u.identity_name || 'Anonymous Node'}</td>
                                <td className="p-4 text-[#888]">{u.email_address}</td>
                                <td className="p-4 text-[#444] italic">{new Date(u.joined_date).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}