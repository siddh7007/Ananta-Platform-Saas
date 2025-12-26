import { Layout, LayoutProps } from 'react-admin';
import CustomMenu from './CustomMenu';
import CustomAppBar from './CustomAppBar';

export default function CustomLayout(props: LayoutProps) {
  return <Layout {...props} menu={CustomMenu} appBar={CustomAppBar} />;
}
