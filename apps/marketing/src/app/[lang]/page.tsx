// import { getDictionary } from "@/utils/get-dictionary";
import { Locale } from '@/utils/i18n-config';

import LocaleSwitcher from './components/locale-switcher';

export default async function Home(props: {
  params: Promise<{ lang: Locale }>;
}) {
  const { lang } = await props.params;

  // const dictionary = await getDictionary(lang);
  return (
    <div>
      Current language: {lang}
      <LocaleSwitcher />
    </div>
  );
}
