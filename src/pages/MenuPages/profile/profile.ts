import { Component, NgZone, ChangeDetectorRef } from '@angular/core';
import { IonicPage, 
         NavController, 
         NavParams, 
         LoadingController, 
         ModalController,
         MenuController } from 'ionic-angular';
import { PostsRes } from 'models/models';
import { SteemiaProvider } from 'providers/steemia/steemia';
import { SteemConnectProvider } from 'providers/steemconnect/steemconnect';
import { SteeemActionsProvider } from 'providers/steeem-actions/steeem-actions';
import { AlertsProvider } from 'providers/alerts/alerts';

@IonicPage({
  priority: 'high'
})
@Component({
  selector: 'page-profile',
  templateUrl: 'profile.html',
})
export class ProfilePage {

  private skip: number = 0;

  private sections: string = "blog";
  private account_data: Object;
  private username: string;
  private current_user: string;

  private steem_account_data: Object;

  private reward_vesting_steem;
  private reward_vesting_balance;
  private vesting_shares;
  private effective_sp;

  private contents: Array<any> = [];
  private is_loading = true;
  private limit: number = 15;
  private is_more_post: boolean = true;
  showToolbar:boolean = false;
  private no_post: boolean = false;

  private start_author: string = null;
  private start_permlink: string = null;
  private stats = {};
  private voting_power: number = 0;


  constructor(public navCtrl: NavController,
    public navParams: NavParams,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    public menu: MenuController,
    private steemia: SteemiaProvider,
    public loadingCtrl: LoadingController,
    public modalCtrl: ModalController,
    private steemConnect: SteemConnectProvider,
    private alerts: AlertsProvider,
    private steemActions: SteeemActionsProvider) {

    this.username = this.navParams.get('author');

    this.current_user = (this.steemConnect.user_temp as any).user;
  }

  private render_image() {
    return 'https://steemitimages.com/u/' + this.username + '/avatar/small';
  }

  ionViewDidLoad() {

    this.zone.runOutsideAngular(() => {
      this.dispatchPosts();
    });

    this.get_account();
    this.steemia.dispatch_stats(this.username).then((data: any) => {
      (this.stats as any).followers_count = data.followers_count;
      (this.stats as any).following_count = data.following_count;
    });

    this.steemia.get_voting_power(this.username).then((data:any) => {
      this.voting_power = data.voting_power.toFixed(3);
    });
  }

  ionViewDidEnter() {
    this.menu.enable(false);
  }

  ionViewDidLeave() {
    this.menu.enable(true);
  }

  /**
   * Method to dispatch hot and avoid repetition of code
   */
  private dispatchPosts(action?: string, event?: any) {
    let que;

    if (this.start_author !== null && this.start_permlink !== null) {
      que = {
        user: this.username,
        username: this.current_user,
        limit: this.limit,
        start_author: this.start_author,
        start_permlink: this.start_permlink
      }
    }

    else {
      que = {
        user: this.username,
        username: this.current_user,
        limit: this.limit
      }
    }
    // Call the API
    this.steemia.dispatch_profile_posts(que).then((res: PostsRes) => {

      // Check if the action is to refresh. If so, we need to 
      // reinitialize all the data after initializing the query
      // to avoid the data to dissapear
      if (action === "refresh") {
        this.reinitialize();
      }

      if (res.results.length === 0) {
        this.is_more_post = false;
      }

      this.contents = this.contents.concat(res.results);

      this.start_author = (res as any).offset_author;
      this.start_permlink = (res as any).offset;

      // Set the loading spinner to false
      this.is_loading = false

      // If this was called from an event, complete it
      if (event) {
        event.complete();
      }

      // Tell Angular that changes were made since we detach the auto check
      this.cdr.detectChanges();
    });
  }

  /**
   * Method to get account data from API
   */
  private get_account() {
    let loading = this.loadingCtrl.create({
      content: 'Please wait...'
    });
  
    loading.present();
    this.steemia.dispatch_profile_info({
      user: this.username,
      username: this.current_user,
    }).then(data => {
      this.account_data = data;
      loading.dismiss();
    });
  }

  public presentProfileModal() {
    let profileModal = this.modalCtrl.create('EditProfilePage', {steem_account_data: (this.account_data as any).json_metadata});
    profileModal.present();
  }


  /**
   * 
   * Method to refresh the current post for future data.
   * 
   * @param {Event} refresher
   */
  private doRefresh(refresher): void {
    this.zone.runOutsideAngular(() => {
      this.dispatchPosts("refresh", refresher);
    });
  }

  /**
   * 
   * Method to load data while scrolling.
   * 
   * @param {Event} infiniteScroll
   */
  private doInfinite(infiniteScroll): void {
    this.zone.runOutsideAngular(() => {
      this.dispatchPosts("inifinite", infiniteScroll);
    });
  }

  /**
   * Method to reinitialize the state.
   * Used for pull to refresh the posts
   */
  private reinitialize(): void {
    this.limit = 15;
    this.contents = [];
    this.is_more_post = true;
  }

  /**
   * Method to listen the scroll event and adjust the tabbar
   * transparency
   */
  private onScroll($event): void {
    let scrollTop = $event.scrollTop;
    this.showToolbar = scrollTop >= 160;
    this.cdr.detectChanges();
  }

  /**
   * Private method to make Angular detect changes when
   * segments are changed.
   */
  private segmentChanged(): void {
    this.cdr.detectChanges();
  }

  /**
   * Method to open followers page
   */
  private open_followers() {
    this.navCtrl.push('FollowListPage', {
      Title: 'Followers',
      Username: this.username
    });
  }

  /**
   * Method to open following page
   */
  private open_following() {
    this.navCtrl.push('FollowListPage', {
      Title: 'Following',
      Username: this.username
    });
  }
}
